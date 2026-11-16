
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { parseDocument } from "htmlparser2";

const htmlFiles = ["index.html"];
const externalUrls = new Set();
let errors = 0;

function report(message) {
    console.error(`ERRO: ${message}`);
    errors++;
}

function walk(node, file, baseDir) {
    if (!node) return;

    if (
        node.type === "tag" &&
        ["a", "img", "link", "script"].includes(node.name)
    ) {
        const attr =
            node.name === "a" || node.name === "link"
                ? "href"
                : "src";

        const value = node.attribs?.[attr];

        if (value) {
            const url = value.trim();

            if (/^(#|mailto:|tel:|data:)/i.test(url)) {
                // Referência interna ou endereço especial.
            } else if (/^https?:\/\//i.test(url)) {
                try {
                    const parsed = new URL(url);
                    externalUrls.add(parsed.href);
                } catch {
                    report(`${file}: URL inválida: ${url}`);
                }
            } else {
                const cleanPath = url.split(/[?#]/)[0];
                const target = resolve(baseDir, cleanPath);

                if (!existsSync(target)) {
                    report(`${file}: caminho não encontrado: ${url}`);
                }
            }
        }
    }

    for (const child of node.children ?? []) {
        walk(child, file, baseDir);
    }
}

for (const file of htmlFiles) {
    if (!existsSync(file)) {
        report(`Arquivo HTML não encontrado: ${file}`);
        continue;
    }

    const source = await readFile(file, "utf8");
    walk(parseDocument(source), file, process.cwd());
}

for (const url of externalUrls) {
    try {
        const response = await fetch(url, {
            method: "HEAD",
            redirect: "follow",
            signal: AbortSignal.timeout(12000)
        });

        if (response.status === 404 || response.status === 410) {
            report(`Link indisponível (${response.status}): ${url}`);
        }
    } catch (error) {
        report(`Não foi possível acessar ${url}: ${error.message}`);
    }
}

if (errors > 0) {
    console.error(`Validação concluída com ${errors} erro(s).`);
    process.exit(1);
}

console.log("Links e caminhos verificados com sucesso.");

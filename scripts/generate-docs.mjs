import { renderFile } from "ejs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { glob } from "glob";
import fs from "node:fs";
import { format } from "prettier";

const escapeMarkdown = (text) => text.replace(/(\|)/g, "\\$1");

const inputsToMarkdownTable = (inputs) => {
  const tableLines = [
    "Input | Description | Required | Default",
    "------|-------------|----------|--------",
  ];

  for (const [key, value] of Object.entries(inputs)) {
    const input = key;
    const description = escapeMarkdown(value.description ?? "")
      .split("\n")
      .join("<br>");
    const required = value.required ? "Yes" : "No";
    const defaultValue = escapeMarkdown(value.default ?? "")
      .split("\n")
      .join("<br>");

    tableLines.push(
      `${input} | ${description} | ${required} | ${defaultValue}`
    );
  }

  return tableLines.join("\n");
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const files = glob.sync("**/*.md.ejs", {
  cwd: path.join(__dirname, ".."),
  absolute: true,
  ignore: ["node_modules/**"],
  nodir: true,
});

for (const file of files) {
  const targetFile = file.replace(/\.ejs$/, "");

  const cwd = process.cwd();
  process.chdir(path.dirname(targetFile));

  const content = await renderFile(
    file,
    {
      inputsToMarkdownTable,
    },
    { async: true }
  );

  process.chdir(cwd);

  const formattedContent = await format(content, { parser: "markdown" });
  fs.writeFileSync(targetFile, formattedContent, { encoding: "utf-8" });
}

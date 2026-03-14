"""Gera fixtures binários da Fase 0 localmente (PDF e XLSX).

Uso:
  python test-fixtures/phase-0/generate_binary_fixtures.py
"""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

ROOT = Path(__file__).resolve().parent


def generate_xlsx(path: Path) -> None:
    rows = [
        ("categoria", "valor"),
        ("receita_liquida", "98500"),
        ("custo_produtos", "60200"),
        ("despesas_operacionais", "18300"),
        ("resultado", "20000"),
    ]

    shared_strings: list[str] = []
    index: dict[str, int] = {}

    def sst_idx(value: str) -> int:
        if value not in index:
            index[value] = len(shared_strings)
            shared_strings.append(value)
        return index[value]

    sheet_rows: list[str] = []
    for i, (col_a, col_b) in enumerate(rows, start=1):
        a_idx = sst_idx(col_a)
        if i == 1:
            b_idx = sst_idx(col_b)
            col_b_xml = f'<c r="B{i}" t="s"><v>{b_idx}</v></c>'
        else:
            col_b_xml = f'<c r="B{i}"><v>{col_b}</v></c>'
        sheet_rows.append(f'<row r="{i}"><c r="A{i}" t="s"><v>{a_idx}</v></c>{col_b_xml}</row>')

    shared_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
        f'count="{len(shared_strings)}" uniqueCount="{len(shared_strings)}">'
        + "".join(f"<si><t>{v}</t></si>" for v in shared_strings)
        + "</sst>"
    )

    sheet_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
        '<dimension ref="A1:B5"/><sheetViews><sheetView workbookViewId="0"/></sheetViews>'
        '<sheetFormatPr defaultRowHeight="15"/><sheetData>'
        + "".join(sheet_rows)
        + "</sheetData></worksheet>"
    )

    created = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    files = {
        "[Content_Types].xml": """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  <Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
</Types>""",
        "_rels/.rels": """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>""",
        "docProps/app.xml": """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Codex Fixture Generator</Application>
</Properties>""",
        "docProps/core.xml": f"""<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>
<cp:coreProperties xmlns:cp=\"http://schemas.openxmlformats.org/package/2006/metadata/core-properties\" xmlns:dc=\"http://purl.org/dc/elements/1.1/\" xmlns:dcterms=\"http://purl.org/dc/terms/\" xmlns:dcmitype=\"http://purl.org/dc/dcmitype/\" xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\">
  <dc:creator>Codex</dc:creator>
  <cp:lastModifiedBy>Codex</cp:lastModifiedBy>
  <dcterms:created xsi:type=\"dcterms:W3CDTF\">{created}</dcterms:created>
  <dcterms:modified xsi:type=\"dcterms:W3CDTF\">{created}</dcterms:modified>
</cp:coreProperties>""",
        "xl/workbook.xml": """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="Resumo" sheetId="1" r:id="rId1"/></sheets>
</workbook>""",
        "xl/_rels/workbook.xml.rels": """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>
</Relationships>""",
        "xl/styles.xml": """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="1"><font><sz val="11"/><name val="Calibri"/><family val="2"/></font></fonts>
  <fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>
</styleSheet>""",
        "xl/sharedStrings.xml": shared_xml,
        "xl/worksheets/sheet1.xml": sheet_xml,
    }

    with ZipFile(path, "w", ZIP_DEFLATED) as zip_file:
        for file_path, content in files.items():
            zip_file.writestr(file_path, content)


def generate_pdf(path: Path) -> None:
    lines = [
        "Fase 0 - PDF textual de teste",
        "Receita: 120000.00",
        "Custos: 75000.00",
        "Resultado operacional: 45000.00",
    ]

    def esc(text: str) -> str:
        return text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")

    ops = ["BT", "/F1 12 Tf", "50 760 Td"]
    for i, line in enumerate(lines):
        if i > 0:
            ops.append("0 -18 Td")
        ops.append(f"({esc(line)}) Tj")
    ops.append("ET")
    stream = "\n".join(ops).encode("latin-1")

    objects = [
        b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
        b"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
        b"3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n",
        b"4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
        f"5 0 obj\n<< /Length {len(stream)} >>\nstream\n".encode("latin-1") + stream + b"\nendstream\nendobj\n",
    ]

    pdf = bytearray(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
    offsets = [0]
    for obj in objects:
        offsets.append(len(pdf))
        pdf.extend(obj)

    xref_pos = len(pdf)
    pdf.extend(f"xref\n0 {len(offsets)}\n".encode("latin-1"))
    pdf.extend(b"0000000000 65535 f \n")
    for offset in offsets[1:]:
        pdf.extend(f"{offset:010d} 00000 n \n".encode("latin-1"))

    pdf.extend(
        f"trailer\n<< /Size {len(offsets)} /Root 1 0 R >>\nstartxref\n{xref_pos}\n%%EOF\n".encode("latin-1")
    )

    path.write_bytes(pdf)


def main() -> None:
    pdf_path = ROOT / "pdf_textual_padrao.pdf"
    xlsx_path = ROOT / "xlsx_simples_padrao.xlsx"
    generate_pdf(pdf_path)
    generate_xlsx(xlsx_path)
    print(f"generated: {pdf_path}")
    print(f"generated: {xlsx_path}")


if __name__ == "__main__":
    main()

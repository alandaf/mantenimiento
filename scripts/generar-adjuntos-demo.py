"""
Genera los documentos de demostración de la planta GLP.

    python scripts/generar-adjuntos-demo.py

Escribe en src/db/seeds/adjuntos/. Los archivos se versionan: la carga de
demostración los copia desde ahí, y así no depende de tener Python en el
servidor.

Todo lo que produce está marcado como documento de demostración. Los valores
coinciden con los del caso guionizado de la P-201A (seeds/glp.ts), para que el
informe, el gráfico y las mediciones de la orden cuenten la misma historia.
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont
from reportlab.lib import colors
from reportlab.lib.pagesizes import A3, A4, landscape
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

SALIDA = Path(__file__).resolve().parent.parent / "src" / "db" / "seeds" / "adjuntos"
SALIDA.mkdir(parents=True, exist_ok=True)

MARCA = "DOCUMENTO DE DEMOSTRACIÓN · NO APTO PARA OPERACIÓN"


def marca_de_agua(c: canvas.Canvas, ancho: float, alto: float) -> None:
    c.saveState()
    c.setFillColor(colors.Color(0.85, 0.2, 0.2, alpha=0.10))
    c.setFont("Helvetica-Bold", 44)
    c.translate(ancho / 2, alto / 2)
    c.rotate(28)
    c.drawCentredString(0, 0, "DEMOSTRACIÓN")
    c.restoreState()


# ---------------------------------------------------------------------------
# 1. P&ID simplificado del área 200
# ---------------------------------------------------------------------------
def plano_pid() -> None:
    ancho, alto = landscape(A3)
    c = canvas.Canvas(str(SALIDA / "pid-area-200.pdf"), pagesize=(ancho, alto))
    c.setTitle("P&ID simplificado · Área 200 Almacenamiento y transferencia")
    c.setAuthor("PMS SIMARP · demostración")

    c.setLineWidth(1.2)
    c.rect(10 * mm, 10 * mm, ancho - 20 * mm, alto - 20 * mm)

    def tanque(x, y, tag):
        # Estanque horizontal (salchicha)
        w, h = 95 * mm, 32 * mm
        c.roundRect(x, y, w, h, h / 2)
        c.setFont("Helvetica-Bold", 11)
        c.drawCentredString(x + w / 2, y + h / 2 + 2, tag)
        c.setFont("Helvetica", 7.5)
        c.drawCentredString(x + w / 2, y + h / 2 - 9, "Estanque GLP 115 m³ · 17,5 bar")
        # Transmisor de nivel
        lt = f"LT-{tag[-3:]}"
        cx, cy = x + w - 14 * mm, y + h + 12 * mm
        c.line(cx, y + h, cx, cy - 5 * mm)
        c.circle(cx, cy, 5 * mm)
        c.setFont("Helvetica", 6.5)
        c.drawCentredString(cx, cy + 1, "LT")
        c.drawCentredString(cx, cy - 6, tag[-3:])
        # Válvula de alivio
        px = x + 16 * mm
        c.line(px, y + h, px, y + h + 8 * mm)
        c.line(px - 3 * mm, y + h + 8 * mm, px + 3 * mm, y + h + 14 * mm)
        c.line(px + 3 * mm, y + h + 8 * mm, px - 3 * mm, y + h + 14 * mm)
        c.line(px - 3 * mm, y + h + 8 * mm, px + 3 * mm, y + h + 8 * mm)
        c.line(px - 3 * mm, y + h + 14 * mm, px + 3 * mm, y + h + 14 * mm)
        c.drawString(px + 4 * mm, y + h + 10 * mm, "PSV")
        return x + w / 2, y

    tanques = [tanque(35 * mm + i * 120 * mm, 175 * mm, f"TK-20{i + 1}") for i in range(3)]

    # Colector de succión
    y_col = 140 * mm
    c.setLineWidth(1.6)
    c.line(tanques[0][0], y_col, tanques[-1][0] + 40 * mm, y_col)
    for tx, ty in tanques:
        c.line(tx, ty, tx, y_col)
        # Válvula de bloqueo (moño)
        vy = (ty + y_col) / 2
        p = c.beginPath()
        p.moveTo(tx - 3 * mm, vy + 3 * mm)
        p.lineTo(tx + 3 * mm, vy - 3 * mm)
        p.lineTo(tx + 3 * mm, vy + 3 * mm)
        p.lineTo(tx - 3 * mm, vy - 3 * mm)
        p.close()
        c.setFillColor(colors.white)
        c.drawPath(p, fill=1)
        c.setFillColor(colors.black)
    c.setFont("Helvetica", 7.5)
    c.drawString(tanques[0][0] + 2 * mm, y_col + 2 * mm, 'Colector de succión 6" · GLP líquido')

    # Bombas en paralelo
    def bomba(x, y, tag, motor):
        c.setLineWidth(1.4)
        c.circle(x, y, 9 * mm)
        c.line(x, y + 9 * mm, x + 9 * mm, y)
        c.setFont("Helvetica-Bold", 10)
        c.drawCentredString(x, y - 16 * mm, tag)
        c.setFont("Helvetica", 7)
        c.drawCentredString(x, y - 21 * mm, "Blackmer LGL 158 · 75 kW")
        # Motor
        c.rect(x + 14 * mm, y - 6 * mm, 18 * mm, 12 * mm)
        c.drawCentredString(x + 23 * mm, y - 1.5 * mm, motor)
        c.line(x + 9 * mm, y, x + 14 * mm, y)

    xs = [150 * mm, 240 * mm]
    for x, tag, motor in [(xs[0], "P-201A", "M-201A"), (xs[1], "P-201B", "M-201B")]:
        c.setLineWidth(1.6)
        c.line(x, y_col, x, 100 * mm)
        bomba(x, 90 * mm, tag, motor)
        c.line(x - 9 * mm, 90 * mm, x - 20 * mm, 90 * mm)
        c.line(x - 20 * mm, 90 * mm, x - 20 * mm, 55 * mm)

    # Colector de descarga hacia llenado
    c.setLineWidth(1.6)
    c.line(xs[0] - 20 * mm, 55 * mm, 330 * mm, 55 * mm)
    c.setFont("Helvetica", 7.5)
    c.drawString(xs[0] - 18 * mm, 57 * mm, 'Descarga 4" → Área 300 Llenado de cilindros')
    # Transmisor de presión
    c.setLineWidth(1)
    c.line(300 * mm, 55 * mm, 300 * mm, 65 * mm)
    c.circle(300 * mm, 70 * mm, 5 * mm)
    c.setFont("Helvetica", 6.5)
    c.drawCentredString(300 * mm, 71 * mm, "PT")
    c.drawCentredString(300 * mm, 65.5 * mm, "201")

    # Cuadro de rótulo
    bx, by = ancho - 150 * mm, 12 * mm
    c.setLineWidth(1)
    c.rect(bx, by, 138 * mm, 34 * mm)
    c.setFont("Helvetica-Bold", 10)
    c.drawString(bx + 4 * mm, by + 26 * mm, "PLANTA GLP METROPOLITANA · PGLP-MET-01")
    c.setFont("Helvetica", 8.5)
    c.drawString(bx + 4 * mm, by + 19 * mm, "P&ID simplificado · Área 200 Almacenamiento y transferencia")
    c.drawString(bx + 4 * mm, by + 12 * mm, "Plano PGLP-200-PID-001 · Rev. B · Escala: sin escala")
    c.setFillColor(colors.Color(0.75, 0.1, 0.1))
    c.setFont("Helvetica-Bold", 8)
    c.drawString(bx + 4 * mm, by + 4 * mm, MARCA)
    c.setFillColor(colors.black)

    marca_de_agua(c, ancho, alto)
    c.showPage()
    c.save()


# ---------------------------------------------------------------------------
# 2. Tendencia de vibración de la P-201A (imagen)
# ---------------------------------------------------------------------------
def fuente(tam: int, negrita: bool = False):
    for nombre in (["arialbd.ttf", "DejaVuSans-Bold.ttf"] if negrita else ["arial.ttf", "DejaVuSans.ttf"]):
        try:
            return ImageFont.truetype(nombre, tam)
        except OSError:
            continue
    return ImageFont.load_default()


def tendencia_vibracion() -> None:
    W, H = 1400, 820
    img = Image.new("RGB", (W, H), "white")
    d = ImageDraw.Draw(img)

    x0, y0, x1, y1 = 120, 120, 1340, 700
    vmax = 16.0
    ay = lambda v: y1 - (v / vmax) * (y1 - y0)

    d.text((x0, 30), "P-201A · Bomba de transferencia A · Vibración global (mm/s RMS)", font=fuente(30, True), fill="#1b2330")
    d.text((x0, 72), "Lecturas antes y después de cada intervención correctiva · Mismo punto: descanso lado acople", font=fuente(20), fill="#5b6675")

    # Zonas ISO 10816-3 (grupo 2, rígido) como referencia visual
    zonas = [(0, 2.8, "#e8f5e9", "A/B"), (2.8, 4.5, "#fffde7", "B/C"), (4.5, 7.1, "#fff3e0", "C"), (7.1, vmax, "#ffebee", "D")]
    for a, b, color, et in zonas:
        d.rectangle([x0, ay(b), x1, ay(a)], fill=color)
        d.text((x1 - 60, ay(b) + 6), et, font=fuente(18), fill="#8a94a3")

    for v in range(0, 17, 2):
        d.line([x0, ay(v), x1, ay(v)], fill="#d9dee5")
        d.text((x0 - 50, ay(v) - 11), f"{v}", font=fuente(18), fill="#5b6675")

    d.line([x0, ay(4.5), x1, ay(4.5)], fill="#d32f2f", width=2)
    eventos = [("1.er evento", 7.2, 2.1), ("2.º evento", 9.8, 3.4), ("3.er evento · detención", 13.6, 2.8)]
    paso = (x1 - x0) / len(eventos)
    # En el hueco entre el primer y el segundo evento, donde no la tapa ninguna barra.
    d.text((x0 + paso - 62, ay(4.5) - 26), "Alarma 4,5", font=fuente(18, True), fill="#d32f2f")
    puntos_antes = []
    for i, (nombre, antes, despues) in enumerate(eventos):
        cx = x0 + paso * (i + 0.5)
        xa, xd = cx - 50, cx + 50
        for x, v, color in [(xa, antes, "#d32f2f"), (xd, despues, "#2e7d32")]:
            d.rectangle([x - 32, ay(v), x + 32, y1], fill=color)
            d.text((x - 24, ay(v) - 30), f"{v:.1f}".replace(".", ","), font=fuente(22, True), fill=color)
        puntos_antes.append((xa, ay(antes)))
        d.text((cx - 110, y1 + 14), nombre, font=fuente(20, True), fill="#1b2330")

    d.line(puntos_antes, fill="#b71c1c", width=3)

    d.rectangle([x0, y1 + 60, x0 + 22, y1 + 82], fill="#d32f2f")
    d.text((x0 + 30, y1 + 58), "Antes de intervenir", font=fuente(18), fill="#1b2330")
    d.rectangle([x0 + 260, y1 + 60, x0 + 282, y1 + 82], fill="#2e7d32")
    d.text((x0 + 290, y1 + 58), "Al reponer el servicio", font=fuente(18), fill="#1b2330")
    d.text((W - 640, H - 32), MARCA, font=fuente(16, True), fill="#b71c1c")

    img.save(SALIDA / "tendencia-vibracion-p201a.png", optimize=True)


# ---------------------------------------------------------------------------
# 3. Informe de alineamiento láser de la P-201A
# ---------------------------------------------------------------------------
def informe_alineamiento() -> None:
    ancho, alto = A4
    c = canvas.Canvas(str(SALIDA / "informe-alineamiento-p201a.pdf"), pagesize=A4)
    c.setTitle("Informe de alineamiento · P-201A")
    c.setAuthor("PMS SIMARP · demostración")

    y = alto - 25 * mm
    c.setFont("Helvetica-Bold", 15)
    c.drawString(20 * mm, y, "Informe de alineamiento de ejes")
    y -= 7 * mm
    c.setFont("Helvetica", 10)
    c.drawString(20 * mm, y, "Planta GLP Metropolitana · Área 200 · Conjunto P-201A / M-201A")
    y -= 5 * mm
    c.setFillColor(colors.Color(0.75, 0.1, 0.1))
    c.setFont("Helvetica-Bold", 8.5)
    c.drawString(20 * mm, y, MARCA)
    c.setFillColor(colors.black)

    y -= 12 * mm
    datos = [
        ("Equipo conducido", "P-201A · Bomba Blackmer LGL 158"),
        ("Equipo conductor", "M-201A · Motor WEG W22 75 kW, 2 polos"),
        ("Acople", "Flexible de láminas"),
        ("Instrumento", "Alineador láser de dos cabezales"),
        ("Condición", "Equipo detenido, bloqueado y con permiso de trabajo"),
        ("Tolerancia de referencia", "Angular 0,05 mm/100 mm · Paralela 0,05 mm (3000 rpm)"),
    ]
    c.setFont("Helvetica", 10)
    for k, v in datos:
        c.setFont("Helvetica-Bold", 10)
        c.drawString(20 * mm, y, k)
        c.setFont("Helvetica", 10)
        c.drawString(75 * mm, y, v)
        y -= 6.5 * mm

    y -= 6 * mm
    c.setFont("Helvetica-Bold", 11)
    c.drawString(20 * mm, y, "Resultados")
    y -= 8 * mm

    cols = [20, 75, 115, 150]
    encabezado = ["Medición", "Encontrado", "Corregido", "Tolerancia"]
    filas = [
        ("Angular vertical (mm/100 mm)", "0,31", "0,03", "0,05"),
        ("Angular horizontal (mm/100 mm)", "0,12", "0,02", "0,05"),
        ("Paralela vertical (mm)", "0,18", "0,02", "0,05"),
        ("Paralela horizontal (mm)", "0,09", "0,01", "0,05"),
        ("Pata coja (mm)", "0,22", "0,02", "0,05"),
    ]
    c.setFillColor(colors.Color(0.93, 0.94, 0.96))
    c.rect(18 * mm, y - 2 * mm, 170 * mm, 7 * mm, fill=1, stroke=0)
    c.setFillColor(colors.black)
    c.setFont("Helvetica-Bold", 9.5)
    for x, t in zip(cols, encabezado):
        c.drawString(x * mm, y, t)
    y -= 7 * mm
    for fila in filas:
        for i, (x, t) in enumerate(zip(cols, fila)):
            fuera = i == 1 and float(t.replace(",", ".")) > 0.05
            c.setFillColor(colors.Color(0.8, 0.1, 0.1) if fuera else colors.black)
            c.setFont("Helvetica-Bold" if fuera else "Helvetica", 9.5)
            c.drawString(x * mm, y, t)
        c.setFillColor(colors.black)
        y -= 6.5 * mm

    y -= 8 * mm
    c.setFont("Helvetica-Bold", 11)
    c.drawString(20 * mm, y, "Conclusión")
    y -= 7 * mm
    texto = [
        "La desalineación angular vertical encontrada (0,31 mm/100 mm) es seis veces la tolerancia.",
        "Con este valor, la carga sobre el rodamiento lado acople explica su desgaste prematuro y",
        "la reaparición de la vibración tras los dos reemplazos anteriores, que no incluyeron alineamiento.",
        "",
        "Se corrigió con suplementos bajo las patas del motor y se eliminó la pata coja.",
        "",
        "Recomendación: incorporar la verificación de alineamiento a la pauta de 2.000 h de la bomba",
        "y repetir la medición después de cada intervención que desmonte el acople.",
    ]
    c.setFont("Helvetica", 10)
    for linea in texto:
        c.drawString(20 * mm, y, linea)
        y -= 5.5 * mm

    y -= 12 * mm
    c.line(20 * mm, y, 80 * mm, y)
    c.line(115 * mm, y, 175 * mm, y)
    c.setFont("Helvetica", 8.5)
    c.drawString(20 * mm, y - 5 * mm, "Técnico de alineamiento")
    c.drawString(115 * mm, y - 5 * mm, "Supervisor de mantenimiento")

    marca_de_agua(c, ancho, alto)
    c.showPage()
    c.save()


if __name__ == "__main__":
    plano_pid()
    tendencia_vibracion()
    informe_alineamiento()
    for f in sorted(SALIDA.iterdir()):
        print(f"{f.name}: {f.stat().st_size // 1024} KB")

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT
from docx.shared import Inches, Pt, RGBColor
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

OUT = "/mnt/A614AE7D14AE4FDB/software/software/output/Software-Deployment-Guide.docx"

doc = Document()
section = doc.sections[0]
section.top_margin = Inches(0.65)
section.bottom_margin = Inches(0.65)
section.left_margin = Inches(0.72)
section.right_margin = Inches(0.72)

styles = doc.styles
styles["Normal"].font.name = "Aptos"
styles["Normal"].font.size = Pt(10)
for name, size, color in [("Title", 28, "17324D"), ("Heading 1", 18, "17324D"), ("Heading 2", 13, "176B87")]:
    styles[name].font.name = "Aptos Display"
    styles[name].font.size = Pt(size)
    styles[name].font.color.rgb = RGBColor.from_string(color)

def shade(cell, fill):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:fill"), fill)
    tc_pr.append(shd)

def code(text):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(2)
    p.paragraph_format.space_after = Pt(7)
    p.paragraph_format.left_indent = Inches(0.18)
    p.paragraph_format.right_indent = Inches(0.18)
    p.paragraph_format.keep_together = True
    pPr = p._p.get_or_add_pPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:fill"), "F2F5F7")
    pPr.append(shd)
    r = p.add_run(text)
    r.font.name = "Consolas"
    r.font.size = Pt(8.5)
    return p

def bullet(text):
    doc.add_paragraph(text, style="List Bullet")

header = section.header.paragraphs[0]
header.text = "SOFTWARE.KOSSTI.COM  /  DEPLOYMENT RUNBOOK"
header.runs[0].font.size = Pt(8)
header.runs[0].font.color.rgb = RGBColor(90, 105, 115)

footer = section.footer.paragraphs[0]
footer.alignment = WD_ALIGN_PARAGRAPH.CENTER
footer.add_run("Production deployment handover  •  ")
field = OxmlElement("w:fldSimple")
field.set(qn("w:instr"), "PAGE")
footer._p.append(field)

p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
p.paragraph_format.space_before = Pt(45)
r = p.add_run("DEPLOYMENT GUIDE")
r.bold = True; r.font.size = Pt(11); r.font.color.rgb = RGBColor(23, 107, 135)

t = doc.add_paragraph(style="Title")
t.alignment = WD_ALIGN_PARAGRAPH.CENTER
t.add_run("Software Learning Site")

p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = p.add_run("software.kossti.com")
r.font.size = Pt(16); r.font.color.rgb = RGBColor(70, 82, 92)

doc.add_paragraph("A focused production runbook for deploying, securing, verifying, and updating the Next.js application on the Contabo Ubuntu server.").alignment = WD_ALIGN_PARAGRAPH.CENTER

table = doc.add_table(rows=0, cols=2)
table.alignment = WD_TABLE_ALIGNMENT.CENTER
table.style = "Table Grid"
for a, b in [
    ("Application path", "/var/www/software"),
    ("Domain", "software.kossti.com"),
    ("Application port", "127.0.0.1:3002"),
    ("Runtime", "Node.js 22 / Next.js 16"),
    ("Process manager", "systemd"),
    ("Public proxy", "Nginx on ports 80 and 443"),
]:
    cells = table.add_row().cells
    cells[0].text, cells[1].text = a, b
    shade(cells[0], "E8F0F4")
    cells[0].paragraphs[0].runs[0].bold = True
    for c in cells: c.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER

doc.add_heading("1. Deployment status", level=1)
doc.add_paragraph("The source was cloned and the production build completed successfully. The build generated 153 static pages. The remaining production checks are the systemd service, Nginx virtual host, correct TLS certificate, and public browser verification.")
bullet("Confirmed: repository installed after adding native build tools.")
bullet("Confirmed: npm build completed, including the SQLite seed step.")
bullet("Needs confirmation: software.service is active on 127.0.0.1:3002.")
bullet("Needs confirmation: Nginx serves the software.kossti.com virtual host.")
bullet("Needs confirmation: the certificate contains software.kossti.com.")

doc.add_heading("2. Server prerequisites", level=1)
doc.add_paragraph("Run these commands on the Contabo server as root. The build-essential package is required because better-sqlite3 may compile a native module during npm ci.")
code("apt-get update\napt-get install -y build-essential nginx certbot python3-certbot-nginx\nnode --version\nnpm --version\nnginx -v\ncertbot --version")

doc.add_heading("3. Install and build the application", level=1)
code("cd /var/www/software\nnpm ci\nnpm run build")
doc.add_paragraph("Expected result: the seed command succeeds, Next.js compiles, TypeScript passes, and static page generation finishes without errors.")

doc.add_heading("4. Create the application service", level=1)
doc.add_paragraph("Create a dedicated non-login account and grant it ownership of the application directory:")
code("id software-app >/dev/null 2>&1 || useradd --system --home /var/www/software --shell /usr/sbin/nologin software-app\nchown -R software-app:software-app /var/www/software")
doc.add_paragraph("Create /etc/systemd/system/software.service with this content:")
code("[Unit]\nDescription=Software Learning Site\nAfter=network.target\n\n[Service]\nType=simple\nUser=software-app\nGroup=software-app\nWorkingDirectory=/var/www/software\nEnvironment=NODE_ENV=production\nEnvironment=PORT=3002\nEnvironment=HOSTNAME=127.0.0.1\nExecStart=/usr/bin/npm start\nRestart=always\nRestartSec=5\n\n[Install]\nWantedBy=multi-user.target")
code("systemctl daemon-reload\nsystemctl enable --now software.service\nsystemctl status software.service --no-pager\ncurl -I http://127.0.0.1:3002")

doc.add_heading("5. Configure Nginx", level=1)
doc.add_paragraph("Create /etc/nginx/sites-available/software.kossti.com:")
code("server {\n    listen 80;\n    listen [::]:80;\n    server_name software.kossti.com;\n\n    location / {\n        proxy_pass http://127.0.0.1:3002;\n        proxy_http_version 1.1;\n        proxy_set_header Host $host;\n        proxy_set_header X-Real-IP $remote_addr;\n        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n        proxy_set_header X-Forwarded-Proto $scheme;\n        proxy_set_header Upgrade $http_upgrade;\n        proxy_set_header Connection \"upgrade\";\n    }\n}")
code("ln -sfn /etc/nginx/sites-available/software.kossti.com /etc/nginx/sites-enabled/software.kossti.com\nnginx -t\nsystemctl reload nginx")

doc.add_heading("6. Issue the correct HTTPS certificate", level=1)
doc.add_paragraph("The browser error ERR_CERT_COMMON_NAME_INVALID means Nginx is presenting a certificate that does not contain software.kossti.com. Confirm that the DNS A record points to 13.140.158.119, then request the site-specific certificate:")
code("certbot --nginx -d software.kossti.com --redirect\ncertbot certificates\nnginx -t\nsystemctl reload nginx")
doc.add_paragraph("Inspect the certificate served publicly:")
code("echo | openssl s_client -connect software.kossti.com:443 -servername software.kossti.com 2>/dev/null | openssl x509 -noout -subject -issuer -dates -ext subjectAltName")

doc.add_heading("7. Production verification", level=1)
doc.add_paragraph("Do not consider deployment complete until all checks pass:")
code("systemctl is-active software.service\nss -ltnp | grep ':3002'\ncurl -I http://127.0.0.1:3002\ncurl -I http://software.kossti.com\ncurl -I https://software.kossti.com")
bullet("HTTP redirects to HTTPS.")
bullet("HTTPS returns 200 or an intentional application redirect.")
bullet("The browser shows no certificate warning.")
bullet("The home page, one category page, one lesson page, search, and library load correctly.")
bullet("Static CSS, JavaScript, SVG images, and fonts return successfully.")

doc.add_heading("8. Deploy future updates", level=1)
doc.add_paragraph("Run from /var/www/software on the server after code is pushed to the deployed branch:")
code("cd /var/www/software\ngit pull --ff-only origin main\nnpm ci\nnpm run build\nsystemctl restart software.service\nsystemctl status software.service --no-pager\ncurl -I https://software.kossti.com")
doc.add_paragraph("If npm ci or npm run build fails, do not restart the running service. Fix the build first so the existing production process remains available.")

doc.add_heading("9. Troubleshooting", level=1)
rows = [
    ("better-sqlite3: make not found", "Install build-essential, then rerun npm ci."),
    ("502 Bad Gateway", "Check software.service and curl 127.0.0.1:3002."),
    ("Certificate name mismatch", "Check the active Nginx server_name and rerun Certbot for this exact domain."),
    ("Nginx config rejected", "Run nginx -t; fix the reported file and line before reload."),
    ("Application stops", "Inspect journalctl -u software.service -n 100 --no-pager."),
    ("Old content after deploy", "Confirm git HEAD, rebuild, restart the service, and hard-refresh the browser."),
]
tab = doc.add_table(rows=1, cols=2)
tab.style = "Table Grid"; tab.alignment = WD_TABLE_ALIGNMENT.CENTER
tab.rows[0].cells[0].text = "Symptom"; tab.rows[0].cells[1].text = "Action"
for c in tab.rows[0].cells:
    shade(c, "17324D")
    for run in c.paragraphs[0].runs: run.font.color.rgb = RGBColor(255,255,255); run.bold = True
for idx, row in enumerate(rows):
    cells = tab.add_row().cells
    cells[0].text, cells[1].text = row
    if idx % 2: shade(cells[0], "F4F7F8"); shade(cells[1], "F4F7F8")

doc.add_heading("10. Useful logs and renewal check", level=1)
code("journalctl -u software.service -f\ntail -f /var/log/nginx/access.log /var/log/nginx/error.log\ncertbot renew --dry-run\nsystemctl list-timers | grep certbot")

doc.add_paragraph("Deployment is complete only after the public HTTPS route and representative application pages have been verified in a browser.")
doc.save(OUT)
print(OUT)

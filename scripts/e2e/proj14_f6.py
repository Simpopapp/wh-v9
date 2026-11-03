# E2E — Fechamento AAA do projeto 14, Fase 6 (D14-6a / D14-6b) — versão 1
#
# Verificação em browser real (Playwright/Chromium headless). Rodar com o dev
# server no ar:
#
#     python3 scripts/e2e/proj14_f6.py
#
# Fluxos (PRD §4.6):
#
# 1. Essay com análise IA real — /practice?q=79score-essay-01, submissão e
#    painel "Análise IA detalhada" com rótulo de fonte e "Próximo passo".
# 2. Simulado com retomada de resposta parcial — Simulado Writing, resposta
#    parcial digitada, reload, retomada e rascunho restaurado (D14-3a).
# 3. Recomendação → treino — backup importado, "Próximo passo" em /progress
#    leva a uma prática real.
# 4. Varredura de consistência final — 11 rotas em 390×844: sem overflow
#    horizontal, console limpo, axe 0 violações (D14-6b).
#
# Saída: relatório JSON no stdout; qualquer falha retorna exit 1.

import asyncio
import json
import re
import time
import sys
from pathlib import Path

from playwright.async_api import async_playwright, Page

BASE = "http://localhost:8080"
OUT = Path("/tmp/browser/e2e-f6")
AXE = Path("/dev-server/node_modules/axe-core/axe.min.js")
ROUTES = [
    "/",
    "/practice",
    "/session",
    "/exam",
    "/progress",
    "/vocabulary",
    "/listening",
    "/reading",
    "/speaking",
    "/writing",
    "/settings",
]

REPORT: dict[str, object] = {}
FAILURES: list[str] = []


def expect(name: str, ok: bool, detail: str = "") -> None:
    REPORT[name] = "ok" if ok else f"FALHOU: {detail}"
    if not ok:
        FAILURES.append(f"{name}: {detail}")


ESSAY = (
    "Cities around the world are facing unprecedented pressure on their housing "
    "markets, and governments must act decisively to keep urban life affordable. "
    "Rapid population growth combined with limited land supply has pushed prices "
    "beyond the reach of ordinary families, forcing long commutes and overcrowded "
    "conditions. In my view, the most effective response combines generous "
    "construction of public and private housing with stronger rent protections. "
    "Vienna demonstrates that sustained public investment can deliver high quality "
    "homes at rents well below market rates, while Singapore shows how long term "
    "planning and public ownership of land can house an entire nation securely. "
    "Critics argue that heavy regulation discourages investment, yet evidence from "
    "cities that paired supply expansion with tenant protections shows stable "
    "rents without construction slowdowns. Furthermore, affordable housing brings "
    "wider benefits: workers live closer to jobs, transport networks face less "
    "strain, and communities remain socially mixed rather than divided by income. "
    "Governments should therefore treat housing as essential infrastructure, fund "
    "it accordingly, and measure success by the share of residents who can live "
    "with dignity near their work. Doing nothing is the most expensive option of "
    "all, because unaffordable cities eventually price out the very workers who "
    "make them function."
)


def backup_payload() -> bytes:
    now = int(time.time() * 1000)  # tentativas recentes: a recomendação ignora datas antigas
    attempts = [
        {
            "qid": ["pte-ra-01ef7205", "pte-ra-08967e7a", "pte-ra-0a6d30d0"][i],
            "ts": now - i * 60_000,
            "taskType": "read_aloud",
            "mode": "manual",
            "contentScore": 55 + i,
            "score": 55 + i,
            "wpm": None,
            "durationMs": 1000,
        }
        for i in range(3)
    ]
    return json.dumps(
        {
            "app": "pte-master-hub",
            "version": 7,
            "exportedAt": "2026-11-03T00:00:00.000Z",
            "attempts": attempts,
            "bookmarks": [],
        }
    ).encode()


async def flow_essay(page: Page, errors: list[str]) -> None:
    errors.clear()
    await page.goto(f"{BASE}/practice?q=79score-essay-01", wait_until="domcontentloaded")
    await page.wait_for_timeout(1200)
    box = page.locator("textarea").first
    await box.fill(ESSAY)
    submit = page.get_by_role("button", name=re.compile("Corrigir", re.I)).first
    await submit.scroll_into_view_if_needed()
    await submit.click()
    # O painel pode ser IA real (alguns segundos) ou o fallback rotulado.
    pronto = "score registrado no progresso"
    try:
        await page.wait_for_function(
            f"""() => document.body.innerText.includes("{pronto}")
                 || document.body.innerText.includes("Análise IA indisponível agora")""",
            timeout=90_000,
        )
        body = await page.evaluate("() => document.body.innerText")
        indisponivel = "Análise IA indisponível agora" in body
        expect("essay: análise IA carregou (ou fallback rotulado)", True)
        if indisponivel:
            expect("essay: fallback rotulado como básico", "avaliação básica determinística" in body)
            REPORT["essay: modo"] = "fallback"
        else:
            expect(
                "essay: rótulo de fonte (IA vs básico) presente",
                "avaliação IA · score registrado no progresso" in body,
            )
            expect("essay: próxima ação apresentada", "Próximo passo" in body)
            REPORT["essay: modo"] = "IA real"
    except Exception as e:
        expect("essay: análise IA carregou (ou fallback rotulado)", False, str(e))
    await page.screenshot(path=str(OUT / "1-essay-ia.png"))
    expect("essay: console limpo", len(errors) == 0, "; ".join(errors[:3]))


async def flow_exam_partial(page: Page, errors: list[str]) -> None:
    errors.clear()
    await page.goto(f"{BASE}/exam", wait_until="domcontentloaded")
    await page.wait_for_timeout(900)
    writing = page.get_by_role("button", name=re.compile("Writing", re.I)).first
    await writing.scroll_into_view_if_needed()
    await writing.click()
    await page.wait_for_timeout(700)
    iniciar = page.get_by_role("button", name=re.compile("^Iniciar", re.I)).first
    await iniciar.scroll_into_view_if_needed()
    await iniciar.click()
    try:
        await page.wait_for_selector("text=Questão 1 de", timeout=20_000)
        expect("exam: runner Writing carregou", True)
    except Exception as e:
        expect("exam: runner Writing carregou", False, str(e))
        await browser_fail(page)
        return

    partial = "The passage explains that urban trees lower city temperatures and improve"
    box = page.locator("textarea").first
    await box.fill(partial)
    await page.wait_for_timeout(1200)  # autosave parcial (debounce 400ms)

    await page.reload(wait_until="domcontentloaded")
    await page.wait_for_timeout(1200)
    resume = await page.evaluate(
        "() => /Retomar simulado em andamento/i.test(document.body.innerText)"
    )
    expect("exam: diálogo de retomada após reload", resume)
    if resume:
        dlg = page.locator("[role=alertdialog]").first
        await dlg.get_by_role("button", name=re.compile("^Retomar$", re.I)).click()
        try:
            await page.wait_for_selector("text=Questão 1 de", timeout=20_000)
            value = await page.locator("textarea").first.input_value()
            expect("exam: rascunho parcial restaurado", value.strip() == partial.strip(), value)
        except Exception as e:
            expect("exam: rascunho parcial restaurado", False, str(e))
    await page.screenshot(path=str(OUT / "2-retomada-parcial.png"))
    expect("exam: console limpo", len(errors) == 0, "; ".join(errors[:3]))

    # Limpeza: descarta o draft para não poluir o preview do utilizador.
    await page.goto(f"{BASE}/exam", wait_until="domcontentloaded")
    await page.wait_for_timeout(900)
    discard = page.get_by_role("button", name=re.compile("Speaking", re.I)).first
    if await discard.count():
        await discard.scroll_into_view_if_needed()
        await discard.click()
        await page.wait_for_timeout(500)
        confirm = page.get_by_role("button", name=re.compile("Descartar|Iniciar", re.I)).first
        if await confirm.count():
            await confirm.scroll_into_view_if_needed()
            await confirm.click()
            await page.wait_for_timeout(800)


async def browser_fail(page: Page) -> None:
    await page.screenshot(path=str(OUT / "2-falha-exam.png"))


async def flow_recommendation(page: Page, errors: list[str], backup_path: Path) -> None:
    errors.clear()
    await page.goto(f"{BASE}/settings", wait_until="domcontentloaded")
    await page.wait_for_timeout(900)
    await page.set_input_files('input[type="file"]', backup_path)
    await page.wait_for_timeout(600)
    await page.get_by_role("button", name=re.compile("Substituir progresso", re.I)).first.click()
    await page.wait_for_timeout(600)
    sem = page.get_by_role("button", name=re.compile("Importar mesmo assim", re.I))
    if await sem.count():
        await sem.first.click()
        await page.wait_for_timeout(600)

    await page.goto(f"{BASE}/progress", wait_until="domcontentloaded")
    await page.wait_for_timeout(1200)
    body = await page.evaluate("() => document.body.innerText")
    expect("progress: cartão 'Próximo passo' presente", "Próximo passo" in body, body[:300])
    comecar = page.get_by_role("button", name=re.compile("Começar|Abrir vocabulário", re.I)).first
    if await comecar.count():
        await comecar.scroll_into_view_if_needed()
        await comecar.click()
        try:
            await page.wait_for_url(re.compile(r"/practice\?q="), timeout=10_000)
            await page.wait_for_timeout(1500)
            body2 = await page.evaluate("() => document.body.innerText")
            expect(
                "practice: questão carregada pela recomendação",
                "Questão" in body2 or "prática" in body2.lower(),
                body2[:300],
            )
            REPORT["practice: destino"] = page.url
        except Exception as e:
            expect("practice: questão carregada pela recomendação", False, str(e))
    else:
        expect("practice: questão carregada pela recomendação", False, "botão Começar ausente")
    await page.screenshot(path=str(OUT / "3-recomendacao.png"))
    expect("recomendação: console limpo", len(errors) == 0, "; ".join(errors[:3]))


async def flow_scan(context, errors: list[str]) -> None:
    for route in ROUTES:
        errors.clear()
        page = await context.new_page()
        page.on("console", lambda m, e=errors: e.append(m.text) if m.type == "error" else None)
        page.on("pageerror", lambda ex, e=errors: e.append(str(ex)))
        await page.set_viewport_size({"width": 390, "height": 844})
        await page.goto(f"{BASE}{route}", wait_until="domcontentloaded")
        await page.wait_for_timeout(1300)
        overflow = await page.evaluate(
            "() => document.documentElement.scrollWidth - document.documentElement.clientWidth"
        )
        expect(f"scan {route}: 390px sem overflow horizontal", overflow <= 1, f"overflow {overflow}px")
        expect(f"scan {route}: console limpo", len(errors) == 0, "; ".join(errors[:3]))
        if AXE.exists():
            await page.add_script_tag(path=str(AXE))
            try:
                result = await page.evaluate(
                    """
                    () => axe.run(document, {
                      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] }
                    }).then(r => r.violations.map(v =>
                      v.id + ':' + v.nodes.length + ':' + (v.nodes[0] ? v.nodes[0].target.join(' ') + ' «' + (v.nodes[0].html || '').slice(0, 160) + '»' : '')
                    ).join(' | '))
                    """
                )
                expect(f"scan {route}: axe 0 violações", not result, result or "")
            except Exception as e:
                expect(f"scan {route}: axe 0 violações", False, str(e))
        await page.close()


async def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    backup_path = OUT / "backup-f6.json"
    backup_path.write_bytes(backup_payload())

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await context.new_page()
        errors: list[str] = []
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append(str(e)))

        await flow_essay(page, errors)
        await flow_exam_partial(page, errors)
        await flow_recommendation(page, errors, backup_path)
        await flow_scan(context, errors)

        await browser.close()

    print(json.dumps(REPORT, indent=1, ensure_ascii=False))
    if FAILURES:
        print("FALHAS: " + " | ".join(FAILURES))
        sys.exit(1)


asyncio.run(main())

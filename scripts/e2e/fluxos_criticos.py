# E2E — fluxos críticos (projeto 13, Fase 6 / PRD §4.6)
#
# Verificação em browser real (Playwright/Chromium headless) dos três fluxos
# críticos do projeto 13, com console limpo como gate. Rodar com o dev server no ar:
#
#     python3 scripts/e2e/fluxos_criticos.py
#
# Fluxos:
#
# 1. prática → tradução → vocabulário → sessão — entrada do /practice, sheet de
#    tradução com IA real, captura no vocabulário e início de sessão.
# 2. simulado retomado — mini-simulado iniciado, reload, diálogo de retomada,
#    mesma questão de volta.
# 3. merge idempotente — o MESMO backup importado 2× (substituir + mesclar)
#    mantém a contagem de tentativas estável.
#
# Saída: relatório JSON no stdout; qualquer falha retorna exit 1.

import json
import re
import sys
from pathlib import Path

from playwright.async_api import async_playwright

BASE = "http://localhost:8080"
OUT = Path("/tmp/browser/e2e")
REPORT: dict[str, object] = {}
FAILURES: list[str] = []


def expect(name: str, ok: bool, detail: str = "") -> None:
    REPORT[name] = "ok" if ok else f"FALHOU: {detail}"
    if not ok:
        FAILURES.append(f"{name}: {detail}")


def backup_payload() -> bytes:
    """Backup mínimo válido (app/version 7) com 2 tentativas distintas."""
    now = 1_700_000_000_000
    attempts = [
        {
            "qid": "ra-0001",
            "ts": now + i,
            "taskType": "read_aloud",
            "mode": "manual",
            "contentScore": 70 + i,
            "score": 70 + i,
            "wpm": None,
            "durationMs": 1000,
        }
        for i in range(2)
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


async def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    backup_path = OUT / "backup-e2e.json"
    backup_path.write_bytes(backup_payload())

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        ctx = await browser.new_context(viewport={"width": 390, "height": 844})
        page = await ctx.new_page()
        errors: list[str] = []
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append(str(e)))

        # ---------- Fluxo 1: prática → tradução → vocabulário → sessão ----------
        errors.clear()
        # Studia Plus: ativa tradução por palavra, IA e captura (pré-requisito do gesto).
        await page.goto(f"{BASE}/settings", wait_until="domcontentloaded")
        await page.wait_for_timeout(900)
        for label in ["Tradução por palavra", "Tradução inteligente (IA)", "Salvar traduções no vocabulário"]:
            sw = page.get_by_role("switch", name=re.compile(label, re.I)).first
            if await sw.count() and (await sw.get_attribute("data-state")) != "checked":
                await sw.click()
                await page.wait_for_timeout(300)
        await page.goto(f"{BASE}/practice", wait_until="domcontentloaded")
        await page.wait_for_timeout(800)
        entry = await page.evaluate("() => document.body.innerText.length > 100")
        expect("practice: entrada própria renderiza", entry)
        # Recomendação do dia: uma questão de Read Aloud (com palavras clicáveis).
        href = await page.evaluate(
            "() => { const as = [...document.querySelectorAll('a[href*=\"?q=\"]')];"
            " return (as.map(a => a.getAttribute('href')).find(h => /ra-/.test(h)) ?? as[0]?.getAttribute('href')); }"
        )
        expect("practice: link de questão na entrada", bool(href), f"href={href}")
        await page.goto(f"{BASE}{href}", wait_until="domcontentloaded")
        await page.wait_for_timeout(1500)
        shell = await page.evaluate("() => document.body.innerText")
        expect("practice: questão carregada", "Questão" in shell or "prática" in shell.lower(), shell[:120])
        await page.screenshot(path=str(OUT / "1-pratica.png"))

        # Tradução: clica a primeira palavra (role=button em PlusWordText).
        word_btn = page.locator('[role="button"][aria-label*="raduç"], [role="button"]').first
        clicked = False
        try:
            await word_btn.click(timeout=4000)
            clicked = True
        except Exception:
            pass
        expect("practice: palavra clicável para tradução", clicked)
        sheet_open = False
        translated = False
        if clicked:
            try:
                await page.wait_for_selector('[role="dialog"]', timeout=4000)
                sheet_open = True
                # IA real: aguarda conteúdo do sheet crescer além do título.
                await page.wait_for_timeout(12_000)
                txt = await page.evaluate(
                    "() => { const d = document.querySelector('[role=dialog]'); return d ? d.innerText : ''; }"
                )
                translated = len(txt) > 40
                await page.screenshot(path=str(OUT / "2-sheet.png"))
                close = page.get_by_role("button", name=re.compile("Fechar", re.I))
                if await close.count():
                    await close.first.click()
            except Exception as e:
                expect("practice: sheet abriu", False, str(e))
        expect("practice: sheet de tradução abriu", sheet_open)
        expect("practice: tradução com conteúdo (IA real)", translated)

        await page.goto(f"{BASE}/vocabulary", wait_until="domcontentloaded")
        await page.wait_for_timeout(900)
        vocab_txt = await page.evaluate("() => document.body.innerText")
        expect("vocabulary: página renderiza", len(vocab_txt) > 100)

        await page.goto(f"{BASE}/session", wait_until="domcontentloaded")
        await page.wait_for_timeout(900)
        start = page.get_by_role("button", name=re.compile("Começar sessão", re.I)).first
        started = False
        try:
            await start.scroll_into_view_if_needed()
            await start.click(timeout=4000)
            await page.wait_for_timeout(1500)
            started = "Questão" in (await page.evaluate("() => document.body.innerText"))
        except Exception as e:
            expect("session: início", False, str(e))
        expect("session: sessão inicia e mostra a primeira questão", started)
        await page.screenshot(path=str(OUT / "3-sessao.png"))
        expect("fluxo 1: console limpo", len(errors) == 0, "; ".join(errors[:3]))

        # ---------- Fluxo 2: simulado retomado ----------
        errors.clear()
        await page.goto(f"{BASE}/exam", wait_until="domcontentloaded")
        await page.wait_for_timeout(900)
        mini = page.get_by_role("button", name=re.compile("Mini-simulado", re.I)).first
        await mini.scroll_into_view_if_needed()
        await mini.click()
        await page.wait_for_timeout(700)
        iniciar = page.get_by_role("button", name=re.compile("^Iniciar", re.I)).first
        await iniciar.scroll_into_view_if_needed()
        await iniciar.click()
        try:
            await page.wait_for_selector("text=Questão 1 de", timeout=15_000)
            expect("exam: runner carregou", True)
        except Exception as e:
            expect("exam: runner carregou", False, str(e))
        # Reload → draft retomável.
        await page.reload(wait_until="domcontentloaded")
        await page.wait_for_timeout(1200)
        resume = await page.evaluate("() => /Retomar simulado em andamento/i.test(document.body.innerText)")
        expect("exam: diálogo de retomada após reload", resume)
        if resume:
            dlg = page.locator("[role=alertdialog]").first
            await dlg.get_by_role("button", name=re.compile("^Retomar$", re.I)).click()
            try:
                await page.wait_for_selector("text=Questão 1 de", timeout=15_000)
                expect("exam: retomou na mesma questão", True)
            except Exception as e:
                expect("exam: retomou na mesma questão", False, str(e))
        await page.screenshot(path=str(OUT / "4-retomada.png"))
        expect("fluxo 2: console limpo", len(errors) == 0, "; ".join(errors[:3]))

        # ---------- Fluxo 3: merge idempotente (mesmo backup 2×) ----------
        errors.clear()
        await page.goto(f"{BASE}/settings", wait_until="domcontentloaded")
        await page.wait_for_timeout(900)

        async def importar(mode: str) -> None:
            await page.set_input_files('input[type="file"]', backup_path)
            await page.wait_for_timeout(600)
            label = "Substituir progresso" if mode == "replace" else "Mesclar com o atual"
            await page.get_by_role("button", name=label).first.click()
            await page.wait_for_timeout(600)
            # Sem-undo: confirma quando aparecer.
            sem = page.get_by_role("button", name=re.compile("Importar mesmo assim", re.I))
            if await sem.count():
                await sem.first.click()
                await page.wait_for_timeout(600)

        await importar("replace")
        await page.goto(f"{BASE}/progress", wait_until="domcontentloaded")
        await page.wait_for_timeout(900)
        n1 = await page.evaluate(
            "() => (document.body.innerText.match(/(\\d+) tentativa\\(s\\) registradas/) || [])[1]"
        )
        expect("merge: 1ª importação = 2 tentativas", n1 == "2", f"obtido {n1}")

        await page.goto(f"{BASE}/settings", wait_until="domcontentloaded")
        await page.wait_for_timeout(900)
        await importar("merge")
        await page.goto(f"{BASE}/progress", wait_until="domcontentloaded")
        await page.wait_for_timeout(900)
        n2 = await page.evaluate(
            "() => (document.body.innerText.match(/(\\d+) tentativa\\(s\\) registradas/) || [])[1]"
        )
        expect("merge: 2ª importação do MESMO backup mantém 2 tentativas", n2 == "2", f"obtido {n2}")
        await page.screenshot(path=str(OUT / "5-merge.png"))
        expect("fluxo 3: console limpo", len(errors) == 0, "; ".join(errors[:3]))

        await browser.close()

    print(json.dumps(REPORT, indent=1, ensure_ascii=False))
    if FAILURES:
        print("FALHAS: " + " | ".join(FAILURES))
        sys.exit(1)


import asyncio

asyncio.run(main())

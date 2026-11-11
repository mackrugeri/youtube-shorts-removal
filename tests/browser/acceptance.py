import base64, json, os, subprocess, tempfile, select, time, shutil
from pathlib import Path

with tempfile.TemporaryDirectory() as profile:
    extension_dir = Path(profile) / 'unpacked-extension'
    shutil.copytree('extension', extension_dir, ignore=shutil.ignore_patterns('_metadata'))
    chrome = os.environ.get('CHROME_BIN', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
    with tempfile.TemporaryFile() as log:
        browser = subprocess.Popen(
            ['/bin/bash', '-c', 'exec 3<&0 4>&1; exec "$@"', 'chrome-pipe', chrome,
             '--headless', '--no-first-run', '--no-default-browser-check',
             '--disable-background-networking', '--remote-debugging-pipe',
             '--enable-unsafe-extension-debugging', '--user-data-dir=' + profile],
            stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=log,
        )
        buf = b''
        counter = 0
        session = None
        document_requests = []

        def call(method, params=None, target=False):
            global buf, counter
            counter += 1
            payload = dict(id=counter, method=method, params=params or {})
            if target:
                payload['sessionId'] = session
            browser.stdin.write(json.dumps(payload).encode() + b'\0')
            browser.stdin.flush()
            while True:
                while b'\0' not in buf:
                    if not select.select([browser.stdout], [], [], 8)[0]:
                        raise RuntimeError('Chrome did not respond to ' + method)
                    data = os.read(browser.stdout.fileno(), 65536)
                    if not data:
                        raise RuntimeError('Chrome exited')
                    buf += data
                raw, buf = buf.split(b'\0', 1)
                reply = json.loads(raw)
                if reply.get('method') == 'Fetch.requestPaused':
                    document_requests.append(reply['params']['request']['url'])
                    request = dict(id=-1, sessionId=reply['sessionId'], method='Fetch.fulfillRequest', params={
                        'requestId': reply['params']['requestId'], 'responseCode': 200,
                        'responseHeaders': [{'name':'Content-Type','value':'text/html'}],
                        'body': base64.b64encode(fixture).decode(),
                    })
                    browser.stdin.write(json.dumps(request).encode() + b'\0')
                    browser.stdin.flush()
                if reply.get('id') == counter:
                    if 'error' in reply:
                        raise RuntimeError(reply['error'])
                    return reply['result']

        def evaluate(expression):
            result = call('Runtime.evaluate', {'expression': expression, 'awaitPromise': True,
                                                'returnByValue': True}, target=True)
            if 'exceptionDetails' in result:
                raise RuntimeError(result['exceptionDetails'])
            return result['result'].get('value')

        try:
            extension = call('Extensions.loadUnpacked', {'path': str(extension_dir)})['id']
            url = f'chrome-extension://{extension}/popup/popup.html'
            tab = call('Target.createTarget', {'url': 'about:blank'})['targetId']
            session = call('Target.attachToTarget', {'targetId': tab, 'flatten': True})['sessionId']
            call('Page.navigate', {'url': url}, target=True)
            def wait(condition):
                for _ in range(80):
                    try:
                        if evaluate(f"Boolean({condition})"):
                            return
                    except RuntimeError as error:
                        if not any(message in str(error) for message in (
                            'Inspected target navigated', 'Cannot find context',
                            'Execution context was destroyed',
                        )):
                            raise
                    time.sleep(.05)
                raise AssertionError(condition)
            wait("document.querySelector('#status')?.textContent === 'Hide Shorts is on.'")
            for width in (140, 344):
                call('Emulation.setDeviceMetricsOverride',
                     {'width': width, 'height': 640, 'deviceScaleFactor': 1, 'mobile': False}, target=True)
                assert evaluate('document.body.getBoundingClientRect().width') == 344
                assert evaluate("""(() => {
                  const button = document.querySelector('#hide-shorts').getBoundingClientRect();
                  const panel = document.querySelector('.settings').getBoundingClientRect();
                  return button.right <= panel.right && document.querySelector('main').scrollWidth === 344;
                })()""")
            print('PASS: popup keeps its intended width and fits its switch')
            assert evaluate("""(async () => {
              const manifest = chrome.runtime.getManifest();
              const icons = {...manifest.icons, ...manifest.action.default_icon};
              for (const [size, path] of Object.entries(icons)) {
                const icon = new Image();
                icon.src = chrome.runtime.getURL(path);
                await icon.decode();
                if (icon.naturalWidth !== Number(size) || icon.naturalHeight !== Number(size)) return false;
              }
              return Object.keys(icons).length === 5;
            })()""")
            print('PASS: Chrome decodes all registered icon sizes')
            assert evaluate("document.querySelector('#hide-shorts').checked")
            evaluate("document.querySelector('#hide-shorts').click()")
            assert evaluate("!document.querySelector('#confirmation').hidden && document.activeElement.id === 'cancel'")
            evaluate("document.querySelector('#cancel').click()")
            assert evaluate("document.querySelector('#confirmation').hidden && document.querySelector('#hide-shorts').checked")
            evaluate("document.querySelector('#hide-shorts').click(); document.querySelector('#confirm').click()")
            wait("document.querySelector('#status')?.textContent === 'Hide Shorts is off.'")
            call('Page.reload', {}, target=True)
            wait("document.querySelector('#status')?.textContent === 'Hide Shorts is off.'")
            evaluate("document.querySelector('#hide-shorts').click()")
            wait("document.querySelector('#status')?.textContent === 'Hide Shorts is on.'")
            assert evaluate("document.querySelector('#hide-shorts').checked")
            for scheme in ['light','dark']:
                call('Emulation.setEmulatedMedia', {'features':[{'name':'prefers-color-scheme','value':scheme}]},target=True)
                assert evaluate("getComputedStyle(document.body).backgroundColor") == (
                    'rgb(247, 245, 252)' if scheme == 'light' else 'rgb(23, 19, 31)')
            call('Emulation.setDeviceMetricsOverride', {'width': 360, 'height': 460, 'deviceScaleFactor': 1, 'mobile': False}, target=True)
            def press(key, code, virtual):
                for event in ['keyDown', 'keyUp']:
                    call('Input.dispatchKeyEvent', {'type':event,'key':key,'code':code,'windowsVirtualKeyCode':virtual}, target=True)
            evaluate("document.querySelector('#hide-shorts').focus()")
            press(' ', 'Space', 32)
            assert evaluate("!document.querySelector('#confirmation').hidden && document.activeElement.id === 'cancel'")
            press('Escape', 'Escape', 27)
            assert evaluate("document.querySelector('#confirmation').hidden && document.activeElement.id === 'hide-shorts'")
            evaluate("chrome.storage.local.set({settings: {schemaVersion: 999}})")
            call('Page.reload', {}, target=True)
            wait("document.querySelector('#retry')?.hidden === false")
            assert evaluate("document.querySelector('#hide-shorts').disabled && document.querySelector('#error').textContent.length > 0")
            evaluate("chrome.storage.local.remove('settings')")
            evaluate("document.querySelector('#retry').click()")
            wait("document.querySelector('#status')?.textContent === 'Hide Shorts is on.'")
            print('PASS: keyboard Space/Escape, focus restoration, error and retry')
            fixture = Path('tests/fixtures/shorts-surfaces.html').read_bytes()
            call('Emulation.setDeviceMetricsOverride',
                 {'width': 960, 'height': 640, 'deviceScaleFactor': 1, 'mobile': False}, target=True)
            call('Fetch.enable', {'patterns': [{'urlPattern':'*://*.youtube.com/*', 'resourceType':'Document'}]}, target=True)
            call('Page.navigate', {'url': 'https://www.youtube.com/'}, target=True)
            wait("document.querySelector('#normal-card') && !document.querySelector('#shelf, #short-card, #short-guide')")
            assert evaluate("Boolean(document.querySelector('#normal-guide'))")
            evaluate("document.querySelector('#mixed').insertAdjacentHTML('beforeend', '<ytd-rich-item-renderer id=late><a href=/shorts/late>Late</a></ytd-rich-item-renderer>')")
            wait("!document.querySelector('#late')")
            document_requests.clear()
            call('Page.navigate', {'url': 'https://www.youtube.com/shorts/test?feature=share#demo'}, target=True)
            wait("location.pathname === '/' && document.querySelector('#normal-card')")
            assert evaluate('location.href') == 'https://www.youtube.com/'
            assert document_requests and all('/shorts/' not in request for request in document_requests), document_requests
            evaluate("history.pushState({}, '', '/watch?v=normal')")
            assert evaluate("location.pathname === '/watch'")
            result = evaluate("""(() => {
              try { history.pushState({}, '', '/shorts/spa'); } catch {}
              return location.pathname;
            })()""")
            assert result == '/watch', result
            wait("location.pathname === '/' && document.querySelector('#normal-card')")
            print('PASS: direct redirect and synchronous SPA route cancellation')
            print('PASS: dedicated shelf, mixed cards, guide and late insertion')
            youtube_session = session
            control = '#voice-search + #shorts-removal-search-control'
            wait(f'document.querySelector("{control}")?.getAttribute("aria-checked") === "true"')
            evaluate('document.querySelector("ytd-masthead").replaceWith(document.querySelector("ytd-masthead").cloneNode(true))')
            evaluate('document.querySelector("#shorts-removal-search-control").remove()')
            wait(f'document.querySelectorAll("{control}").length === 1')
            call('Emulation.setDeviceMetricsOverride',
                 {'width': 640, 'height': 640, 'deviceScaleFactor': 1, 'mobile': False}, target=True)
            assert evaluate(f"""(() => {{
                const button = document.querySelector('{control}');
                return button.offsetWidth === 36 &&
                  getComputedStyle(button.querySelector('.shorts-removal-control-label')).display === 'none' &&
                  button.getAttribute('aria-label') === 'Hide Shorts';
            }})()""")
            evaluate(f'document.querySelector("{control}").focus()')
            press(' ', 'Space', 32)
            wait('document.querySelector("#shorts-removal-confirmation")?.open')
            press('Escape', 'Escape', 27)
            wait('!document.querySelector("#shorts-removal-confirmation")?.open')
            assert evaluate(f'document.querySelector("{control}").getAttribute("aria-checked")') == 'true'
            evaluate(f'document.querySelector("{control}").focus()')
            press(' ', 'Space', 32)
            evaluate('document.querySelector("#shorts-removal-confirmation button:last-child").focus()')
            press(' ', 'Space', 32)
            wait(f'document.querySelector("{control}")?.getAttribute("aria-checked") === "false" && document.querySelector("#shelf")')
            assert evaluate(f'document.querySelector("{control} .shorts-removal-control-state").textContent') == 'Off'
            print('PASS: search control mounts beside voice search, remounts and confirms disabling')
            popup = call('Target.createTarget', {'url': 'about:blank'})['targetId']
            popup_session = call('Target.attachToTarget', {'targetId': popup, 'flatten': True})['sessionId']
            session = popup_session
            call('Page.navigate', {'url': url}, target=True)
            wait("document.querySelector('#status')?.textContent === 'Hide Shorts is off.'")
            evaluate("chrome.declarativeNetRequest.updateEnabledRulesets({enableRulesetIds:['shorts_redirect']})")
            assert evaluate("chrome.runtime.sendMessage({type:'settings:get'}).then(reply => reply.settings.hideShorts)") is False
            assert evaluate("chrome.declarativeNetRequest.getEnabledRulesets()") == []
            print('PASS: saved off preference reconciles a mismatched ruleset')
            session = youtube_session
            wait("document.querySelector('#shelf') && document.querySelector('#short-card')")
            call('Page.navigate', {'url': 'https://www.youtube.com/shorts/allowed'}, target=True)
            wait("location.pathname === '/shorts/allowed' && document.querySelector('#shelf')")
            call('Target.activateTarget', {'targetId': tab})
            evaluate(f'document.querySelector("{control}").focus()')
            press(' ', 'Space', 32)
            for _ in range(80):
                if evaluate("location.pathname === '/' && Boolean(document.querySelector('#normal-card')) && !document.querySelector('#shelf')"):
                    break
                time.sleep(.05)
            else:
                raise AssertionError(evaluate('[location.href, document.title, document.documentElement.outerHTML.slice(0,700)]'))
            wait(f'document.querySelector("{control}")?.getAttribute("aria-checked") === "true"')
            assert evaluate(f'document.querySelector("{control} .shorts-removal-control-state").textContent') == 'On'
            print('PASS: header switch turns filtering off and on, with matching visible state')
            session = popup_session
            call('Page.reload', {}, target=True)
            wait("document.querySelector('#status')?.textContent === 'Hide Shorts is on.'")
            print('PASS: popup reports applied state after reopening')
            fixture = Path('tests/fixtures/channel-filters.html').read_bytes()
            session = youtube_session
            call('Target.activateTarget', {'targetId': tab})
            call('Page.navigate', {'url': 'https://www.youtube.com/'}, target=True)
            wait('document.querySelectorAll("[data-focus-filter-controls]").length === 6')
            assert evaluate("""(() => {
              const metadata = document.querySelector('#focus-first .yt-lockup-metadata-view-model__text-container');
              const actions = metadata.querySelector('[data-focus-filter-controls]');
              const channel = metadata.querySelector('a[href="/@unwanted"]');
              return actions?.parentElement === metadata &&
                actions.getBoundingClientRect().top - channel.getBoundingClientRect().bottom < 20 &&
                actions.querySelectorAll('svg').length === 2;
            })()""")
            print('PASS: compact video actions stay beside metadata in a full-height card')

            def save_block(card, channel, words):
                selector = '[data-block-channel]' if channel else 'button:first-child'
                evaluate(f'document.querySelector("#{card} [data-focus-filter-controls] {selector}").focus()')
                press(' ', 'Space', 32)
                wait('document.querySelector("#focus-filter-dialog")?.open')
                suggestions = evaluate('document.querySelector("#focus-filter-keywords").value')
                assert suggestions, 'Title keyword suggestions are missing'
                evaluate('document.querySelector("#focus-filter-keywords").value = ' + json.dumps(words))
                evaluate('document.querySelector("#focus-filter-dialog [type=submit]").focus()')
                press(' ', 'Space', 32)
                wait('!document.querySelector("#focus-filter-dialog").open')

            save_block('focus-first', False, 'prank')
            wait('document.querySelector("#focus-first").hasAttribute("data-focus-filter-hidden") && document.querySelector("#focus-related").hasAttribute("data-focus-filter-hidden")')
            assert evaluate('!document.querySelector("#focus-normal").hasAttribute("data-focus-filter-hidden") && !document.querySelector("#focus-substring").hasAttribute("data-focus-filter-hidden")')
            save_block('focus-channel', True, 'gardening')
            wait('document.querySelector("#focus-channel").hasAttribute("data-focus-filter-hidden") && document.querySelector("#focus-gardening").hasAttribute("data-focus-filter-hidden")')
            call('Page.reload', target=True)
            wait('document.querySelector("#focus-first")?.hasAttribute("data-focus-filter-hidden") && document.querySelector("#focus-channel")?.hasAttribute("data-focus-filter-hidden")')
            print('PASS: user actions save channel/video blocks and cross-channel keywords after reload')

            session = popup_session
            previous_load = evaluate('performance.timeOrigin')
            call('Page.reload', target=True)
            wait(f'performance.timeOrigin !== {previous_load} && document.readyState === "complete"')
            evaluate('document.querySelector(".saved-filters").open = true')
            wait('document.querySelector("#filters-count")?.textContent === "(4)"')
            saved = evaluate('chrome.runtime.sendMessage({type:"filters:get"}).then(reply => reply.filters)')
            assert len(saved['channels']) == 1 and len(saved['videos']) == 1
            assert saved['keywords'] == ['prank', 'gardening']

            # Restart the browser against the same profile and unpacked extension.
            browser.terminate()
            browser.wait(timeout=5)
            browser = subprocess.Popen(browser.args, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=log)
            buf = b''
            session = None
            assert call('Extensions.loadUnpacked', {'path': str(extension_dir)})['id'] == extension
            restart_tab = call('Target.createTarget', {'url': url})['targetId']
            session = call('Target.attachToTarget', {'targetId': restart_tab, 'flatten': True})['sessionId']
            wait('document.querySelector(".saved-filters")')
            persisted = evaluate('chrome.runtime.sendMessage({type:"filters:get"}).then(reply => reply.filters)')
            assert persisted == saved, (persisted, saved)
            restarted_popup_session = session
            tab = call('Target.createTarget', {'url': 'about:blank'})['targetId']
            session = call('Target.attachToTarget', {'targetId': tab, 'flatten': True})['sessionId']
            call('Target.activateTarget', {'targetId': tab})
            call('Fetch.enable', {'patterns': [{'urlPattern':'*://*.youtube.com/*', 'resourceType':'Document'}]}, target=True)
            call('Page.navigate', {'url': 'https://www.youtube.com/'}, target=True)
            wait('document.querySelector("#focus-first")?.hasAttribute("data-focus-filter-hidden") && document.querySelector("#focus-channel")?.hasAttribute("data-focus-filter-hidden")')
            assert evaluate('!document.querySelector("#focus-normal").hasAttribute("data-focus-filter-hidden")')
            print('PASS: saved blocks survive a real Chrome restart and filter the returning feed')

            returning_feed_session = session
            session = restarted_popup_session
            evaluate('document.querySelector(".saved-filters").open = true')
            wait('document.querySelector("#filters-count")?.textContent === "(4)"')
            # Remove each rule through the management UI. Storage events update the open feed.
            for _ in range(4):
                evaluate('document.querySelector("#filters-lists button").click()')
                wait('document.querySelector("#filters-status")?.textContent === "Block removed."')
            wait('document.querySelector("#filters-count")?.textContent === "(0)"')
            session = returning_feed_session
            wait('document.querySelectorAll("[data-focus-filter-hidden]").length === 0')
            print('PASS: removing saved rules restores matching cards in another open tab')

        except Exception:
            log.seek(0)
            print(log.read().decode(errors='replace')[-2500:])
            raise
        finally:
            browser.terminate()
            browser.wait(timeout=5)

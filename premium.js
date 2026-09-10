(() => {
  "use strict";
  const apiBase = "https://d5duj0jcignprkgu8glg.kr8f6hld.apigw.yandexcloud.net";
  const sessionKey = "bookdiaryPremiumWebSession";
  const deviceKey = "bookdiaryPremiumWebDevice";
  const accountState = document.querySelector("#accountState");
  const paymentState = document.querySelector("#paymentState");
  const promoState = document.querySelector("#promoState");
  const loginForm = document.querySelector("#loginForm");
  const promoForm = document.querySelector("#promoForm");
  const accountPanel = document.querySelector("#accountPanel");
  const accountEmail = document.querySelector("#accountEmail");
  const accountPremium = document.querySelector("#accountPremium");
  const logoutButton = document.querySelector("#logoutButton");
  const socialAuthPanel = document.querySelector("#socialAuthPanel");
  const googleAuthButton = document.querySelector("#googleAuthButton");
  const vkAuthButton = document.querySelector("#vkAuthButton");
  const vkAuthLabel = document.querySelector("#vkAuthLabel");
  const linkedMethods = document.querySelector("#linkedMethods");
  const socialConfig = window.BookDiarySocialAuth || {};
  const requestedPlan = new URLSearchParams(window.location.search).get("plan") || "";
  let session = loadSession();

  function loadSession() { try { return JSON.parse(sessionStorage.getItem(sessionKey) || "null"); } catch (_) { return null; } }
  function saveSession(value) { session = value; if (value) sessionStorage.setItem(sessionKey, JSON.stringify(value)); else sessionStorage.removeItem(sessionKey); }
  function deviceId() { let value = sessionStorage.getItem(deviceKey); if (!value) { value = crypto.randomUUID ? crypto.randomUUID().replaceAll("-", "") : `${Date.now()}${Math.random()}`; sessionStorage.setItem(deviceKey, value); } return value; }
  function setState(element, value, error = false) { element.textContent = value; element.classList.toggle("isError", error); }
  function renderSession() {
    const loggedIn = Boolean(session?.accessToken);
    loginForm.hidden = loggedIn;
    accountPanel.hidden = !loggedIn;
    accountEmail.textContent = loggedIn ? (session.user?.email || "Аккаунт Дневника Читателя") : "";
    if (!loggedIn) accountPremium.textContent = "";
    if (vkAuthLabel) vkAuthLabel.textContent = loggedIn ? "Привязать VK ID" : "Войти с VK ID";
  }
  function applyRequestedPlan() {
    const target = document.querySelector(`.planButton[data-plan="${requestedPlan}"]`);
    if (!target) return;
    const card = target.closest(".tariffCard");
    if (card) card.classList.add("selectedByApp");
    if (!session?.accessToken) setState(accountState, "Выбран тариф: " + target.closest(".tariffCard").querySelector("h3").textContent + ". Войдите, чтобы продолжить оплату.");
  }
  function messageFor(code) {
    return ({ UNAUTHORIZED: "Сессия закончилась. Войдите снова.", INVALID_CREDENTIALS: "Неверная электронная почта или пароль.", EMAIL_NOT_VERIFIED: "Сначала подтвердите электронную почту в приложении.", ACCOUNT_LINK_REQUIRED: "Аккаунт с этой почтой уже существует. Войдите паролем один раз, затем привяжите этот способ входа.", SOCIAL_IDENTITY_IN_USE: "Этот Google/VK ID уже привязан к другому аккаунту.", SOCIAL_PROVIDER_ALREADY_LINKED: "К аккаунту уже привязан другой профиль этого провайдера.", SOCIAL_EMAIL_REQUIRED: "Провайдер не передал подтверждённую почту. Разрешите доступ к e-mail и повторите вход.", SOCIAL_TOKEN_INVALID: "Провайдер не подтвердил вход. Попробуйте ещё раз.", TRIAL_ALREADY_USED: "Бесплатный период уже использован для этого аккаунта.", PROMO_INVALID: "Промокод неверный.", PROMO_ALREADY_USED: "Этот промокод уже использован для аккаунта.", PROMO_LIMIT_REACHED: "Лимит активаций промокода исчерпан.", WHEEL_PROMO_IN_APP_ONLY: "Этот промокод вводится в приложении, в разделе «Узнайте, что читать».", PAYMENTS_NOT_CONFIGURED: "Оплата временно недоступна. Попробуйте позже.", NETWORK_ERROR: "Нет связи с сервером. Попробуйте ещё раз." })[code] || "Не удалось выполнить запрос. Попробуйте ещё раз.";
  }
  async function request(path, options = {}, retry = true) {
    const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
    if (options.authorized && session?.accessToken) headers.Authorization = `Bearer ${session.accessToken}`;
    let response;
    try { response = await fetch(apiBase + path, { method: options.method || "GET", headers, body: options.body ? JSON.stringify(options.body) : undefined }); } catch (_) { throw new Error("NETWORK_ERROR"); }
    const data = await response.json().catch(() => ({}));
    if (response.status === 401 && options.authorized && retry && await refresh()) return request(path, options, false);
    if (!response.ok) throw new Error(data.error || "REQUEST_FAILED");
    return data;
  }
  async function refresh() { if (!session?.refreshToken) return false; try { const data = await request("/auth/refresh", { method: "POST", body: { refreshToken: session.refreshToken } }, false); saveSession({ ...session, ...data }); renderSession(); return true; } catch (_) { saveSession(null); renderSession(); return false; } }
  async function finishSocial(provider, token) {
    const linking = Boolean(session?.accessToken);
    const path = linking ? "/account/social/link" : "/auth/social";
    setState(accountState, linking ? "Привязываем способ входа…" : "Проверяем вход у провайдера…");
    try {
      const data = await request(path, { method: "POST", authorized: linking, body: { provider, token, deviceId: deviceId() } });
      if (!linking) saveSession(data);
      renderSession();
      await updateAccountState();
      setState(accountState, linking ? "Способ входа привязан к этому аккаунту." : "Вход выполнен.");
    } catch (error) { setState(accountState, messageFor(error.message), true); }
  }
  async function updateLinkedMethods() {
    if (!session?.accessToken || !linkedMethods) return;
    try {
      const data = await request("/account/social", { authorized: true });
      const names = (data.identities || []).map(item => item.provider === "google" ? "Google" : "VK ID");
      linkedMethods.textContent = names.length ? `Привязано: ${names.join(", ")}` : "Google и VK ID пока не привязаны";
    } catch (_) { linkedMethods.textContent = "Не удалось проверить привязанные способы"; }
  }
  async function updateAccountState() {
    renderSession();
    if (!session?.accessToken) { setState(accountState, "Войдите, чтобы активировать бесплатный период, промокод или оплатить тариф."); return; }
    setState(accountState, "");
    accountPremium.textContent = "Проверяем Premium…";
    try { const data = await request("/premium/status", { authorized: true }); accountPremium.classList.remove("isError"); accountPremium.textContent = data.active && data.expiresAt ? `Premium активен до ${new Date(data.expiresAt).toLocaleDateString("ru-RU")}` : "Premium пока не активен"; await updateLinkedMethods(); } catch (error) { accountPremium.textContent = messageFor(error.message); accountPremium.classList.add("isError"); }
  }
  async function requireAccount(target) { if (session?.accessToken) return true; setState(target, "Сначала войдите в аккаунт выше.", true); document.querySelector("#email").focus(); return false; }
  loginForm.addEventListener("submit", async event => { event.preventDefault(); setState(accountState, "Выполняем вход…"); const form = new FormData(loginForm); try { const data = await request("/auth/login", { method: "POST", body: { email: form.get("email"), password: form.get("password"), deviceId: deviceId() } }); saveSession(data); loginForm.reset(); renderSession(); await updateAccountState(); } catch (error) { setState(accountState, messageFor(error.message), true); } });
  logoutButton.addEventListener("click", async () => {
    logoutButton.disabled = true;
    const refreshToken = session?.refreshToken;
    try {
      if (session?.accessToken && refreshToken) {
        await request("/auth/logout", { method: "POST", authorized: true, body: { refreshToken } });
      }
    } catch (_) {
      // Выход на устройстве всё равно должен сработать, даже если сервер временно недоступен.
    } finally {
      saveSession(null);
      renderSession();
      logoutButton.disabled = false;
      setState(accountState, "Вы вышли из аккаунта.");
      setState(paymentState, "");
      setState(promoState, "");
    }
  });
  function randomBase64Url(byteLength = 32) { const bytes = crypto.getRandomValues(new Uint8Array(byteLength)); return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", ""); }
  async function configureGoogle() {
    if (!socialConfig.googleClientId) return;
    socialAuthPanel.hidden = false;
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => {
      google.accounts.id.initialize({ client_id: socialConfig.googleClientId, callback: response => finishSocial("google", response.credential), ux_mode: "popup" });
      google.accounts.id.renderButton(googleAuthButton, { type: "standard", theme: "outline", size: "large", text: session?.accessToken ? "continue_with" : "signin_with", width: 400 });
    };
    document.head.appendChild(script);
  }
  async function configureVk() {
    if (!socialConfig.vkAppId) return;
    socialAuthPanel.hidden = false;
    const script = document.createElement("script");
    script.src = "https://unpkg.com/@vkid/sdk@2.6.1/dist-sdk/umd/index.js";
    script.onload = async () => {
      const saved = JSON.parse(sessionStorage.getItem("bookdiaryVkOauth") || "null");
      const state = saved?.state || randomBase64Url(24);
      const codeVerifier = saved?.codeVerifier || randomBase64Url(48);
      VKID.Config.init({ app: Number(socialConfig.vkAppId), redirectUrl: socialConfig.vkRedirectUrl, state, codeVerifier, scope: "email", mode: VKID.ConfigAuthMode.Redirect });
      const query = new URLSearchParams(location.search);
      if (query.get("code") && query.get("device_id") && saved?.state === query.get("state")) {
        try { const tokens = await VKID.Auth.exchangeCode(query.get("code"), query.get("device_id"), codeVerifier); history.replaceState({}, "", location.pathname); sessionStorage.removeItem("bookdiaryVkOauth"); await finishSocial("vk", tokens.access_token); } catch (_) { setState(accountState, "VK ID не завершил вход. Попробуйте ещё раз.", true); }
      }
      vkAuthButton.addEventListener("click", () => { sessionStorage.setItem("bookdiaryVkOauth", JSON.stringify({ state, codeVerifier })); VKID.Auth.login(); });
    };
    document.head.appendChild(script);
  }
  document.querySelectorAll(".planButton").forEach(button => button.addEventListener("click", async () => { if (!await requireAccount(paymentState)) return; button.disabled = true; setState(paymentState, button.dataset.plan === "trial_3d" ? "Активируем бесплатный период…" : "Создаём защищённую страницу оплаты…"); try { const data = await request("/payments/create", { method: "POST", authorized: true, body: { planId: button.dataset.plan } }); if (data.active) { setState(paymentState, "Premium активирован."); await updateAccountState(); } else if (data.paymentUrl) window.location.assign(data.paymentUrl); else throw new Error("REQUEST_FAILED"); } catch (error) { setState(paymentState, messageFor(error.message), true); } finally { button.disabled = false; } }));
  promoForm.addEventListener("submit", async event => { event.preventDefault(); if (!await requireAccount(promoState)) return; setState(promoState, "Проверяем промокод…"); try { const data = await request("/premium/redeem-promo", { method: "POST", authorized: true, body: { code: document.querySelector("#promoCode").value, source: "website" } }); promoForm.reset(); setState(promoState, data.active ? "Промокод применён. Premium активирован." : "Промокод применён."); await updateAccountState(); } catch (error) { setState(promoState, messageFor(error.message), true); } });
  renderSession();
  configureGoogle();
  configureVk();
  updateAccountState();
  applyRequestedPlan();
})();

(() => {
  "use strict";
  const apiBase = "https://d5duj0jcignprkgu8glg.kr8f6hld.apigw.yandexcloud.net";
  const config = window.BookDiarySocialAuth || {};
  const query = new URLSearchParams(location.search);
  const savedVkAuth = JSON.parse(sessionStorage.getItem("bookdiaryAppVkOauth") || "null");
  const provider = query.get("provider") === "vk" || query.has("code") || savedVkAuth ? "vk" : "google";
  let linkTicket = query.get("link") || savedVkAuth?.linkTicket || "";
  const stateNode = document.querySelector("#appAuthState");
  const googleNode = document.querySelector("#appGoogleButton");
  const vkButton = document.querySelector("#appVkButton");

  function setState(text, error = false) { stateNode.textContent = text; stateNode.classList.toggle("isError", error); }
  function randomBase64Url(size = 32) { const bytes = crypto.getRandomValues(new Uint8Array(size)); return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", ""); }
  async function request(path, body, accessToken = "") {
    const headers = { "Content-Type": "application/json" };
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 25000);
    let response;
    try {
      response = await fetch(apiBase + path, { method: "POST", headers, body: JSON.stringify(body || {}), signal: controller.signal });
    } catch (error) {
      if (error?.name === "AbortError") throw new Error("Сервер не ответил за 25 секунд. Вернитесь в приложение и попробуйте ещё раз.");
      throw new Error("Нет связи с сервером.");
    } finally {
      window.clearTimeout(timeout);
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const messages = {
        ACCOUNT_LINK_REQUIRED: "Эта почта уже зарегистрирована. Вернитесь в приложение, войдите паролем один раз и нажмите «Привязать» в аккаунте.",
        SOCIAL_IDENTITY_IN_USE: "Этот способ входа уже используется другим аккаунтом.",
        SOCIAL_PROVIDER_ALREADY_LINKED: "К аккаунту уже привязан другой профиль этого провайдера.",
        SOCIAL_TICKET_INVALID: "Ссылка устарела. Вернитесь в приложение и начните ещё раз.",
        SOCIAL_EMAIL_REQUIRED: "VK ID не передал подтверждённую почту. Разрешите доступ к e-mail и повторите вход."
      };
      throw new Error(messages[data.error] || "Не удалось подтвердить вход. Попробуйте ещё раз.");
    }
    return data;
  }
  async function finish(providerName, token) {
    setState(linkTicket ? "Привязываем способ входа…" : "Создаём безопасную сессию приложения…");
    try {
      if (linkTicket) {
        await request("/auth/social/link-complete", { provider: providerName, token, linkTicket });
        setState("Google привязан. Вернитесь в приложение и снова откройте экран аккаунта.");
        window.setTimeout(() => location.assign(`bookdiary://open/oauth?linked=${encodeURIComponent(providerName)}`), 700);
        return;
      }
      const session = await request("/auth/social", { provider: providerName, token, deviceId: "web-oauth-bridge" });
      const result = await request("/auth/social/mobile-ticket", {}, session.accessToken);
      // The short-lived browser bridge session is not the app session. Revoke
      // it after the one-time ticket has been created so no orphan refresh
      // token remains active for 90 days.
      try { await request("/auth/logout", { refreshToken: session.refreshToken }, session.accessToken); } catch (_) { /* ticket stays valid for five minutes */ }
      setState("Вход подтверждён. Возвращаемся в приложение…");
      window.setTimeout(() => location.assign(`bookdiary://open/oauth?ticket=${encodeURIComponent(result.ticket)}`), 700);
    } catch (error) { setState(error.message, true); }
  }
  function configureGoogle() {
    if (!config.googleClientId) { setState("Вход Google ещё не включён: не зарегистрирован OAuth client ID.", true); return; }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => {
      google.accounts.id.initialize({ client_id: config.googleClientId, callback: response => finish("google", response.credential), ux_mode: "popup" });
      google.accounts.id.renderButton(googleNode, { type: "standard", theme: "outline", size: "large", text: "continue_with", width: 360 });
      setState("Выберите аккаунт Google.");
    };
    script.onerror = () => setState("Не удалось загрузить вход Google.", true);
    document.head.appendChild(script);
  }
  function configureVk() {
    if (!config.vkAppId) { setState("Вход VK ID ещё не включён: не зарегистрирован APP_ID.", true); return; }
    vkButton.hidden = false;
    const script = document.createElement("script");
    script.src = "https://unpkg.com/@vkid/sdk@2.6.1/dist-sdk/umd/index.js";
    script.onload = async () => {
      const saved = savedVkAuth;
      if (!linkTicket && saved?.linkTicket) linkTicket = saved.linkTicket;
      const state = saved?.state || randomBase64Url(24);
      const codeVerifier = saved?.codeVerifier || randomBase64Url(48);
      VKID.Config.init({ app: Number(config.vkAppId), redirectUrl: `${location.origin}/app-auth.html`, state, codeVerifier, scope: "email", mode: VKID.ConfigAuthMode.Redirect });
      if (query.get("code") && query.get("device_id") && saved?.state === query.get("state")) {
        try { const tokens = await VKID.Auth.exchangeCode(query.get("code"), query.get("device_id"), codeVerifier); sessionStorage.removeItem("bookdiaryAppVkOauth"); await finish("vk", tokens.access_token); } catch (_) { setState("VK ID не завершил вход. Попробуйте ещё раз.", true); }
      } else setState("Нажмите кнопку VK ID.");
      vkButton.addEventListener("click", () => { sessionStorage.setItem("bookdiaryAppVkOauth", JSON.stringify({ state, codeVerifier, linkTicket })); VKID.Auth.login(); });
    };
    script.onerror = () => setState("Не удалось загрузить VK ID.", true);
    document.head.appendChild(script);
  }
  if (provider === "vk") configureVk(); else configureGoogle();
})();

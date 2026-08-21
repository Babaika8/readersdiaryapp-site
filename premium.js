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
  let session = loadSession();

  function loadSession() { try { return JSON.parse(sessionStorage.getItem(sessionKey) || "null"); } catch (_) { return null; } }
  function saveSession(value) { session = value; if (value) sessionStorage.setItem(sessionKey, JSON.stringify(value)); else sessionStorage.removeItem(sessionKey); }
  function deviceId() { let value = sessionStorage.getItem(deviceKey); if (!value) { value = crypto.randomUUID ? crypto.randomUUID().replaceAll("-", "") : `${Date.now()}${Math.random()}`; sessionStorage.setItem(deviceKey, value); } return value; }
  function setState(element, value, error = false) { element.textContent = value; element.classList.toggle("isError", error); }
  function messageFor(code) {
    return ({ UNAUTHORIZED: "Сессия закончилась. Войдите снова.", INVALID_CREDENTIALS: "Неверная электронная почта или пароль.", EMAIL_NOT_VERIFIED: "Сначала подтвердите электронную почту в приложении.", TRIAL_ALREADY_USED: "Бесплатный период уже использован для этого аккаунта.", PROMO_INVALID: "Промокод неверный.", PROMO_ALREADY_USED: "Этот промокод уже использован для аккаунта.", PROMO_LIMIT_REACHED: "Лимит активаций промокода исчерпан.", WHEEL_PROMO_IN_APP_ONLY: "Этот промокод вводится в приложении, в разделе «Узнайте, что читать».", PAYMENTS_NOT_CONFIGURED: "Оплата временно недоступна. Попробуйте позже.", NETWORK_ERROR: "Нет связи с сервером. Попробуйте ещё раз." })[code] || "Не удалось выполнить запрос. Попробуйте ещё раз.";
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
  async function refresh() { if (!session?.refreshToken) return false; try { const data = await request("/auth/refresh", { method: "POST", body: { refreshToken: session.refreshToken } }, false); saveSession({ ...session, ...data }); return true; } catch (_) { saveSession(null); return false; } }
  async function updateAccountState() {
    if (!session?.accessToken) { setState(accountState, "Войдите, чтобы активировать бесплатный период, промокод или оплатить тариф."); return; }
    try { const data = await request("/premium/status", { authorized: true }); const suffix = data.active && data.expiresAt ? ` Premium активен до ${new Date(data.expiresAt).toLocaleDateString("ru-RU")}.` : " Premium пока не активен."; setState(accountState, `Вы вошли как ${session.user?.email || "пользователь"}.${suffix}`); } catch (error) { setState(accountState, messageFor(error.message), true); }
  }
  async function requireAccount(target) { if (session?.accessToken) return true; setState(target, "Сначала войдите в аккаунт выше.", true); document.querySelector("#email").focus(); return false; }
  loginForm.addEventListener("submit", async event => { event.preventDefault(); setState(accountState, "Выполняем вход…"); const form = new FormData(loginForm); try { const data = await request("/auth/login", { method: "POST", body: { email: form.get("email"), password: form.get("password"), deviceId: deviceId() } }); saveSession(data); loginForm.reset(); await updateAccountState(); } catch (error) { setState(accountState, messageFor(error.message), true); } });
  document.querySelectorAll(".planButton").forEach(button => button.addEventListener("click", async () => { if (!await requireAccount(paymentState)) return; button.disabled = true; setState(paymentState, button.dataset.plan === "trial_3d" ? "Активируем бесплатный период…" : "Создаём защищённую страницу оплаты…"); try { const data = await request("/payments/create", { method: "POST", authorized: true, body: { planId: button.dataset.plan } }); if (data.active) { setState(paymentState, "Premium активирован."); await updateAccountState(); } else if (data.paymentUrl) window.location.assign(data.paymentUrl); else throw new Error("REQUEST_FAILED"); } catch (error) { setState(paymentState, messageFor(error.message), true); } finally { button.disabled = false; } }));
  promoForm.addEventListener("submit", async event => { event.preventDefault(); if (!await requireAccount(promoState)) return; setState(promoState, "Проверяем промокод…"); try { const data = await request("/premium/redeem-promo", { method: "POST", authorized: true, body: { code: document.querySelector("#promoCode").value, source: "website" } }); promoForm.reset(); setState(promoState, data.active ? "Промокод применён. Premium активирован." : "Промокод применён."); await updateAccountState(); } catch (error) { setState(promoState, messageFor(error.message), true); } });
  updateAccountState();
})();

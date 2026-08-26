(() => {
  "use strict";

  const apiBase = "https://d5duj0jcignprkgu8glg.kr8f6hld.apigw.yandexcloud.net";
  const form = document.querySelector("#deleteAccountForm");
  const state = document.querySelector("#deleteAccountState");
  const button = form.querySelector("button[type=submit]");

  function setState(message, error = false) {
    state.textContent = message;
    state.classList.toggle("isError", error);
  }

  async function request(path, options) {
    let response;
    try {
      response = await fetch(apiBase + path, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(options.headers || {}) },
        body: JSON.stringify(options.body)
      });
    } catch (_) {
      throw new Error("NETWORK_ERROR");
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "REQUEST_FAILED");
    return data;
  }

  function messageFor(code) {
    return ({
      INVALID_CREDENTIALS: "Неверная электронная почта или пароль.",
      EMAIL_NOT_VERIFIED: "Сначала подтвердите электронную почту в приложении.",
      ACCOUNT_NOT_FOUND: "Аккаунт не найден.",
      DELETE_CONFIRMATION_REQUIRED: "Для подтверждения напишите слово «УДАЛИТЬ».",
      NETWORK_ERROR: "Нет связи с сервером. Попробуйте ещё раз."
    })[code] || "Не удалось удалить аккаунт. Попробуйте ещё раз или отправьте запрос в поддержку.";
  }

  form.addEventListener("submit", async event => {
    event.preventDefault();
    const values = new FormData(form);
    if (String(values.get("confirmation") || "").trim().toUpperCase() !== "УДАЛИТЬ") {
      setState("Для подтверждения напишите слово «УДАЛИТЬ».", true);
      return;
    }

    button.disabled = true;
    setState("Проверяем аккаунт и удаляем облачные данные…");
    try {
      const login = await request("/auth/login", {
        body: {
          email: values.get("email"),
          password: values.get("password"),
          deviceId: `webdelete${Date.now()}${Math.random().toString(16).slice(2)}`
        }
      });
      await request("/account/delete", {
        headers: { Authorization: `Bearer ${login.accessToken}` },
        body: { confirmation: "DELETE" }
      });
      sessionStorage.removeItem("bookdiaryPremiumWebSession");
      form.reset();
      form.hidden = true;
      setState("Аккаунт и облачные данные удалены. Локальные книги на телефоне не изменены.");
    } catch (error) {
      setState(messageFor(error.message), true);
      button.disabled = false;
    }
  });
})();

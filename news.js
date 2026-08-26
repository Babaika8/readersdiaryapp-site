(() => {
  "use strict";

  const apiBase = "https://d5duj0jcignprkgu8glg.kr8f6hld.apigw.yandexcloud.net";
  const feed = document.querySelector("#news-feed");
  const archiveSection = document.querySelector("#news-archive-section");
  const archive = document.querySelector("#news-archive");

  function formattedDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
  }

  function addMedia(container, item) {
    if (item.mediaType === "video" && item.videoUrl) {
      const frame = document.createElement("iframe");
      frame.className = "newsVideo";
      frame.src = item.videoUrl;
      frame.title = item.title;
      frame.loading = "lazy";
      frame.allow = "autoplay; encrypted-media; fullscreen; picture-in-picture";
      frame.allowFullscreen = true;
      container.appendChild(frame);
      return;
    }
    if (item.imageUrl) {
      const image = document.createElement("img");
      image.className = "newsImage";
      image.src = item.imageUrl;
      image.alt = item.title;
      image.loading = "lazy";
      container.appendChild(image);
    }
  }

  function addBody(container, item) {
    const title = document.createElement("h3");
    title.textContent = item.title;
    container.appendChild(title);
    const date = formattedDate(item.publishedAt);
    if (date) {
      const time = document.createElement("time");
      time.textContent = date;
      time.dateTime = item.publishedAt;
      container.appendChild(time);
    }
    if (item.text) {
      const text = document.createElement("p");
      text.textContent = item.text;
      container.appendChild(text);
    }
    const link = document.createElement("a");
    link.className = "textLink";
    link.href = item.url;
    link.target = "_blank";
    link.rel = "noopener";
    link.textContent = "Открыть во ВКонтакте →";
    container.appendChild(link);
  }

  function render(items) {
    feed.replaceChildren();
    if (!items.length) {
      const empty = document.createElement("p");
      empty.textContent = "В сообществе пока нет публикаций.";
      feed.appendChild(empty);
      return;
    }

    items.slice(0, 5).forEach(item => {
      const article = document.createElement("article");
      article.className = "newsCard";
      addMedia(article, item);
      const body = document.createElement("div");
      body.className = "newsCardBody";
      addBody(body, item);
      article.appendChild(body);
      feed.appendChild(article);
    });

    const older = items.slice(5);
    archive.replaceChildren();
    archiveSection.hidden = older.length === 0;
    older.forEach(item => {
      const details = document.createElement("details");
      details.className = "newsArchiveItem";
      const summary = document.createElement("summary");
      const date = formattedDate(item.publishedAt);
      summary.textContent = date ? `${date} — ${item.title}` : item.title;
      details.appendChild(summary);
      const body = document.createElement("div");
      body.className = "newsArchiveBody";
      addMedia(body, item);
      addBody(body, item);
      details.appendChild(body);
      archive.appendChild(details);
    });
  }

  async function loadFallback() {
    const response = await fetch("/news.json");
    if (!response.ok) throw new Error("fallback unavailable");
    const items = await response.json();
    return items.map(item => ({ ...item, text: item.text || "", mediaType: "text", publishedAt: item.publishedAt || "" }));
  }

  async function loadNews() {
    try {
      const response = await fetch(`${apiBase}/news/vk`);
      if (!response.ok) throw new Error("VK unavailable");
      const payload = await response.json();
      if (payload.configured) return render(Array.isArray(payload.items) ? payload.items : []);
      render(await loadFallback());
    } catch (_) {
      try { render(await loadFallback()); }
      catch (error) { feed.textContent = "Не удалось загрузить новости. Откройте сообщество ВКонтакте."; }
    }
  }

  loadNews();
})();

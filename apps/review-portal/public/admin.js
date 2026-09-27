const $ = (s) => document.querySelector(s);
const lang =
  new URL(location.href).searchParams.get("lang") ??
  document.cookie
    .split(";")
    .map((s) => s.trim())
    .find((s) => /^dental-language=(en|tr)$/.test(s))
    ?.split("=")[1] ??
  "en";
const tr = lang === "tr",
  t = (en, turkish) => (tr ? turkish : en);
document.documentElement.lang = tr ? "tr" : "en";
$("#language").value = tr ? "tr" : "en";
for (const [id, en, turkish] of [
  ["workspace-link", "Workspace", "Çalışma alanı"],
  ["eyebrow", "PRIVATE · MANAGEMENT", "GİZLİ · YÖNETİM"],
  ["title", "Project dashboard", "Proje kontrol paneli"],
  [
    "intro",
    "Aggregate activity and the work awaiting your team.",
    "Toplam kullanım ve ekibinizin incelemesini bekleyen işler.",
  ],
  ["refresh", "Refresh", "Yenile"],
  ["reauth", "Verify identity again", "Yeniden giriş yap"],
  [
    "private-note",
    "Authorised managers only · UTC reporting",
    "Yalnız yetkili yöneticiler · UTC zaman dilimi",
  ],
])
  $("#" + id).textContent = t(en, turkish);
$("#period-label").firstChild.textContent = t("Period ", "Dönem ");
for (const o of $("#period").options)
  o.textContent = o.value + t(" days", " gün");
$("#language").onchange = (e) => {
  const url = new URL(location.href);
  url.searchParams.set("lang", e.target.value);
  location.href = url;
};
const el = (tag, text, cls) => {
  const n = document.createElement(tag);
  if (text !== undefined) n.textContent = String(text);
  if (cls) n.className = cls;
  return n;
};
const number = (n) => Number(n).toLocaleString(tr ? "tr-TR" : "en-US");
const roleNames = {
  photo_contributor: t("Photo contributors", "Fotoğraf katkıcıları"),
  privacy_reviewer: t("Privacy reviewers", "Gizlilik denetleyicileri"),
  anatomy_reviewer: t("Anatomy team members", "Anatomi ekibi üyeleri"),
};
const stateNames = {
  pending: t("Awaiting review", "İnceleme bekliyor"),
  approved: t("Approved", "Onaylandı"),
  rejected: t("Rejected", "Reddedildi"),
  withdrawn: t("Withdrawn", "Geri çekildi"),
  uploading: t("Uploading", "Yükleniyor"),
  processing: t("Processing", "İşleniyor"),
  blocked: t("Quarantined / blocked", "Karantinada / engellendi"),
  privacy_review: t("Privacy review", "Gizlilik incelemesi"),
  privacy_cleared: t("Privacy cleared", "Gizlilik incelemesi uygun"),
  needs_information: t("Needs information", "Bilgi bekliyor"),
};
const pageNames = {
  atlas: t("3D atlas", "3B atlas"),
  interior: t("Tooth interior", "Dişin içi"),
  project: t("Project", "Proje"),
  guide: t("Capture guide", "Çekim rehberi"),
  contributions: t("Contributions", "Katkılar"),
  report: t("Technical reports", "Teknik bildirimler"),
};
function table(title, headers, rows) {
  const section = el("section", undefined, "card");
  section.append(el("h2", title));
  const wrap = el("div", undefined, "stats-table-wrap"),
    table = el("table"),
    head = el("thead"),
    tr = el("tr");
  headers.forEach((h) => {
    const th = el("th", h);
    th.scope = "col";
    tr.append(th);
  });
  head.append(tr);
  table.append(head);
  const body = el("tbody");
  for (const row of rows) {
    const tr = el("tr");
    row.forEach((value) => tr.append(el("td", value)));
    body.append(tr);
  }
  table.append(body);
  wrap.append(table);
  section.append(wrap);
  if (!rows.length)
    section.append(el("p", t("No records yet.", "Henüz kayıt yok.")));
  return section;
}
let timer,
  request = null;
function clear() {
  clearTimeout(timer);
  request?.abort();
  request = null;
  $("#stats-content").replaceChildren();
  $("#stats-content").hidden = true;
}
async function refresh() {
  clear();
  const controller = new AbortController();
  request = controller;
  $("#stats-error").hidden = true;
  $("#status").textContent = t("Checking access…", "Yetki kontrol ediliyor…");
  $("#refresh").disabled = true;
  try {
    const sessionResponse = await fetch("/review/api/session", {
      cache: "no-store",
      signal: controller.signal,
    });
    if (!sessionResponse.ok) throw Error("unavailable");
    const session = await sessionResponse.json();
    if (!session.authenticated || !session.membership?.manager)
      throw Error("access");
    const until = new Date(session.authAt).getTime() + 15 * 60000 - Date.now();
    if (until <= 0) throw Error("expired");
    const response = await fetch(
      "/review/api/management/statistics?days=" + $("#period").value,
      { cache: "no-store", signal: controller.signal },
    );
    if ([401, 403].includes(response.status)) throw Error("access");
    if (!response.ok) throw Error("unavailable");
    const data = await response.json();
    if (controller.signal.aborted) return;
    const root = $("#stats-content");
    root.hidden = false;
    const cards = el("section", undefined, "stats-cards");
    for (const [label, value, note] of [
      [
        t("Enabled members", "Etkin üyeler"),
        data.members.enabled,
        t("Current count", "Güncel toplam"),
      ],
      [
        t("Pending applications", "Bekleyen başvurular"),
        data.queue.pending,
        t("Oldest: ", "En eski: ") +
          number(Math.floor(data.queue.oldest_hours)) +
          t(" hours", " saat"),
      ],
      [
        t(
          "Photos awaiting privacy review",
          "Gizlilik incelemesi bekleyen fotoğraflar",
        ),
        data.photoQueue.pending,
        t("Oldest: ", "En eski: ") +
          number(Math.floor(data.photoQueue.oldest_hours)) +
          t(" hours", " saat"),
      ],
      [
        t("Active member sessions", "Aktif üye oturumları"),
        data.activeMemberSessions,
        t(
          "Last 15 minutes; not site visitors",
          "Son 15 dakika; site ziyaretçisi değildir",
        ),
      ],
    ]) {
      const card = el("article", undefined, "card");
      card.append(
        el("p", label),
        el("strong", number(value), "stat-value"),
        el("p", note, "muted"),
      );
      cards.append(card);
    }
    root.append(cards);
    root.append(
      el(
        "p",
        data.photoIntakeEnabled
          ? t(
              "Photo intake: open to authorised contributors",
              "Fotoğraf kabulü: yetkili katkıcılara açık",
            )
          : t("Photo intake: paused", "Fotoğraf kabulü: kapalı"),
        "notice",
      ),
    );
    const groups = el("div", undefined, "stats-columns");
    groups.append(
      table(
        t("Current active roles", "Güncel aktif görevler"),
        [t("Role", "Görev"), t("Members", "Üye")],
        data.roles.map((r) => [roleNames[r.role] ?? r.role, number(r.count)]),
      ),
      table(
        t("Application status · all time", "Başvuru durumları · tüm dönem"),
        [t("Status", "Durum"), t("Count", "Sayı")],
        data.applications.map((r) => [stateNames[r.status], number(r.count)]),
      ),
    );
    root.append(groups);
    root.append(
      table(
        t(
          "Photo pipeline · retained records",
          "Fotoğraf süreci · saklanan kayıtlar",
        ),
        [
          t("Status", "Durum"),
          t("Files", "Dosya"),
          t("Declared size (MiB)", "Beyan edilen boyut (MiB)"),
        ],
        data.photos.map((r) => [
          stateNames[r.state] ?? r.state,
          number(r.count),
          number((Number(r.bytes) / 1048576).toFixed(1)),
        ]),
      ),
    );
    root.append(
      el(
        "p",
        t(
          "Declared upload sizes are not disk usage. Deleted packages are excluded. Privacy clearance is not permission to publish.",
          "Beyan edilen yükleme boyutları disk kullanımı değildir. Silinen paketler hariçtir. Gizlilik uygunluğu yayın izni değildir.",
        ),
        "muted",
      ),
    );
    const usage = el("section", undefined, "card");
    usage.append(
      el(
        "h2",
        t("Site usage · selected period", "Site kullanımı · seçilen dönem"),
      ),
    );
    if (!data.usage.available) {
      usage.append(
        el(
          "p",
          t(
            "Usage counts are unavailable; this is not a zero-visitor result.",
            "Kullanım sayıları şu anda alınamıyor; bu, sıfır ziyaretçi anlamına gelmez.",
          ),
        ),
      );
    } else {
      if (data.usage.stale)
        usage.append(
          el(
            "p",
            t(
              "Collection heartbeat is stale. These are the last available counts; later traffic is unknown.",
              "Sayaç güncellemesi gecikmiş. Bunlar son alınan sayılar; sonraki trafik bilinmiyor.",
            ),
            "notice",
          ),
        );
      usage.append(
        el(
          "p",
          t(
            "Successful page responses, including reloads and bots. No unique-user, IP, cookie, device or location tracking.",
            "Yenilemeler ve botlar dahil başarılı sayfa yanıtları. Tekil kullanıcı, IP, çerez, cihaz veya konum takibi yok.",
          ),
        ),
      );
      usage.append(
        el(
          "p",
          t("Collection started: ", "Sayım başlangıcı: ") +
            new Date(data.usage.startedAt).toLocaleString() +
            t(" · Snapshot: ", " · Son kayıt: ") +
            new Date(data.usage.updatedAt).toLocaleString(),
          "muted",
        ),
      );
      usage.append(
        table(
          t("Pages", "Sayfalar"),
          [t("Page", "Sayfa"), t("Responses", "Yanıt")],
          Object.entries(data.usage.totals).map(([k, n]) => [
            pageNames[k],
            number(n),
          ]),
        ),
      );
    }
    root.append(usage);
    const daily = new Map(
      (data.usage.daily ?? []).map((r) => [r.day, r.count]),
    );
    root.append(
      table(
        t("Daily activity · UTC", "Günlük etkinlik · UTC"),
        [
          t("Day", "Gün"),
          t("New applications", "Yeni başvuru"),
          t("Privacy decisions", "Gizlilik kararı"),
          t("Page responses", "Sayfa yanıtı"),
        ],
        data.timeline.map((r) => [
          r.day,
          number(r.applications),
          number(r.privacy_decisions),
          data.usage.available &&
          r.day >= data.usage.startedAt.slice(0, 10) &&
          r.day <= data.usage.updatedAt.slice(0, 10) &&
          !(
            data.usage.stale &&
            r.day === data.usage.updatedAt.slice(0, 10) &&
            !daily.has(r.day)
          )
            ? number(daily.get(r.day) ?? 0)
            : "—",
        ]),
      ),
    );
    $("#status").textContent =
      t("Updated: ", "Güncellendi: ") +
      new Date(data.generatedAt).toLocaleString();
    timer = setTimeout(
      () => {
        clear();
        $("#status").textContent = t(
          "Verify your identity again to view statistics.",
          "İstatistikleri görmek için yeniden giriş yapın.",
        );
      },
      Math.max(0, until),
    );
  } catch (e) {
    if (e.name === "AbortError") return;
    clear();
    $("#stats-error").hidden = false;
    $("#stats-error").textContent = ["access", "expired"].includes(e.message)
      ? t(
          "A current manager session with recent two-step verification is required.",
          "Güncel yönetici yetkisi ve yakın zamanda iki aşamalı giriş gerekiyor.",
        )
      : t(
          "Statistics could not be loaded. Retry without assuming the counts are zero.",
          "İstatistikler alınamadı. Sayıları sıfır varsaymadan yeniden deneyin.",
        );
    $("#status").textContent = "";
  } finally {
    if (request === controller || !request) $("#refresh").disabled = false;
  }
}
$("#refresh").onclick = refresh;
$("#period").onchange = refresh;
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    clear();
    $("#status").textContent = t(
      "Refresh to verify access again.",
      "Yetkiyi tekrar kontrol etmek için yenileyin.",
    );
  }
});
refresh();

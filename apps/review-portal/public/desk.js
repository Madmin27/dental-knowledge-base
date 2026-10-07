const $ = (s) => document.querySelector(s);
const tr =
  (new URL(location.href).searchParams.get("lang") ??
    document.cookie.match(/(?:^|;\s*)dental-language=(en|tr)/)?.[1] ??
    "en") === "tr";
const t = (en, turkish) => (tr ? turkish : en);
document.documentElement.lang = tr ? "tr" : "en";
$("#language").value = tr ? "tr" : "en";
$("#language").onchange = (e) => {
  const u = new URL(location.href);
  u.searchParams.set("lang", e.target.value);
  location.href = u;
};
$("#eyebrow").textContent = t(
  "PRIVATE · EDITORIAL OPERATIONS",
  "ÖZEL · EDİTÖR ÇALIŞMA ALANI",
);
$("#title").textContent = t("Contribution desk", "Katkı değerlendirme masası");
$("#intro").textContent = t(
  "Read submissions, respond to contributors and prepare separately approved technical tasks. Every response here is visible to the contributor.",
  "Katkıları inceleyin, katkı sahibine yanıt verin ve ayrıca onaylanacak teknik işler hazırlayın. Buradaki her yanıt katkı sahibine görünür.",
);
$("#boundary").textContent = t(
  "Editorial triage is not scientific acceptance.",
  "Editör ön incelemesi bilimsel kabul değildir.",
);
$("#refresh").textContent = t("Refresh", "Yenile");
$("#login").textContent = t("Sign in again", "Yeniden giriş");
$("#queue-label").textContent=t("Queue", "Kuyruk");
$("#queue-filter").options[0].textContent=t("Atlas / content contributions", "Atlas / içerik katkıları");
$("#queue-filter").options[1].textContent=t("Platform feedback", "Platform geri bildirimleri");
const root = $("#desk-content"),
  message = $("#message");
let csrf,
  selected,
  expiry,
  generation = 0;
const n = (tag, text, parent) => {
  const e = document.createElement(tag);
  if (text !== undefined) e.textContent = text;
  if (parent) parent.append(e);
  return e;
};
const stateNames = {
  received: t("Received", "Alındı"),
  triage: t("Triage", "Ön inceleme"),
  needs_evidence: t("Evidence requested", "Kaynak bekleniyor"),
  change_planned: t("Change planned", "Değişiklik planlandı"),
  addressed: t("Implementation reported", "Uygulama bildirildi"),
  closed: t("Closed", "Kapatıldı"),
};
const changes = {
  received: ["triage", "needs_evidence", "closed"],
  triage: ["needs_evidence", "change_planned", "closed"],
  needs_evidence: ["triage", "closed"],
  change_planned: ["triage", "addressed", "closed"],
  addressed: ["triage", "closed"],
  closed: ["triage"],
};
function clear() {
  generation++;
  root.replaceChildren();
  root.hidden = true;
  csrf = null;
  clearTimeout(expiry);
}
async function api(path = "", data) {
  const current = generation;
  const r = await fetch("/review/api/desk" + path, {
    method: data ? "POST" : "GET",
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
    headers: data
      ? { "Content-Type": "application/json", "X-CSRF-Token": csrf }
      : {},
    ...(data ? { body: JSON.stringify(data) } : {}),
  });
  const b = await r.json();
  if (document.hidden || current !== generation)
    throw Error(
      t(
        "View changed; refresh to continue.",
        "Görünüm değişti; devam etmek için yenileyin.",
      ),
    );
  if (!r.ok) {
    if ([401, 403].includes(r.status)) clear();
    throw Error(b.error ?? "Request failed");
  }
  return b;
}
function field(form, label, tag = "input") {
  const l = n("label", label, form);
  const f = n(tag, undefined, l);
  f.required = true;
  if (tag === "textarea") {
    f.rows = 5;
    f.maxLength = 4000;
  }
  return f;
}
function action(form, label, fn) {
  const b = n("button", label, form);
  b.type = "submit";
  form.onsubmit = async (e) => {
    e.preventDefault();
    b.disabled = true;
    try {
      await fn();
      await open(selected);
    } catch (e) {
      message.textContent = e.message;
    } finally {
      b.disabled = false;
    }
  };
}
async function open(id) {
  generation++;
  selected = id;
  const r = await api("/" + id);
  root.replaceChildren();
  root.hidden = false;
  message.textContent = "";
  n("h2", stateNames[r.status] + " · " + r.submission.category, root);
  n("p", t("Private reference: ", "Özel kayıt: ") + r.id, root);
  if(r.submission.category==='feedback') n("p", t("Area / topic: ","Alan / konu: ")+r.submission.view.page+' · '+r.submission.view.section+' · '+r.submission.view.topic,root);
  n("p", r.submission.description, root).style.whiteSpace = "pre-wrap";
  n("p", r.submission.expected, root);
  for (const link of r.submission.evidence) {
    const a = n("a", link, root);
    a.href = link;
    a.target = "_blank";
    a.rel = "noreferrer noopener";
    n("br", undefined, root);
  }
  n(
    "h3",
    t("Contributor-visible history", "Katkı sahibine görünen geçmiş"),
    root,
  );
  for (const e of r.events) {
    const box = n("section", undefined, root);
    n(
      "strong",
      (e.actor === "maintainer"
        ? t("Editor", "Editör")
        : t("Contributor", "Katkı sahibi")) +
        " · " +
        new Date(e.at).toLocaleString(),
      box,
    );
    n("p", e.note, box);
    if (e.actorId) n("small", t("Account: ", "Hesap: ") + e.actorId, box);
    for (const link of e.evidence) {
      const a = n("a", link, box);
      a.href = link;
      a.target = "_blank";
      a.rel = "noreferrer noopener";
    }
  }
  if (r.redactedAt || r.archivedAt) {
    n("p", t("Read-only record.", "Salt okunur kayıt."), root);
    return;
  }
  const assignment = r.events.findLast((e) => e.task)?.task;
  if (assignment)
    n(
      "p",
      t("Responsible editor: ", "Sorumlu editör: ") +
        assignment.owner +
        " · " +
        t("Follow-up due: ", "Takip tarihi: ") +
        new Date(assignment.dueAt).toLocaleString(),
      root,
    );
  const claim = n("form", undefined, root);
  const due = field(
    claim,
    t("Follow-up within 30 days", "30 gün içinde takip tarihi"),
  );
  due.type = "date";
  due.value = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const priority = field(claim, t("Priority", "Öncelik"), "select");
  for (const v of ["normal", "high"]) {
    const o = n("option", v, priority);
    o.value = v;
  }
  action(
    claim,
    t("Take responsibility for triage", "Ön incelemeyi üzerime al"),
    () =>
      api("/" + id + "/events", {
        revision: r.revision,
        note: "Editor accepted responsibility for triage and follow-up. This is not scientific review or acceptance.",
        task: {
          priority: priority.value,
          dueAt: new Date(due.value + "T12:00:00Z").toISOString(),
        },
      }),
  );
  const form = n("form", undefined, root);
  n("h3", t("Reasoned response", "Gerekçeli yanıt"), form);
  const status = field(form, t("Next state", "Sonraki durum"), "select");
  for (const value of [r.status, ...changes[r.status]]) {
    const o = n("option", stateNames[value], status);
    o.value = value;
  }
  const note = field(
    form,
    t(
      "Response in English · visible to the contributor",
      "İngilizce yanıt · katkı sahibine görünür",
    ),
    "textarea",
  );
  note.minLength = 5;
  const evidence = field(
    form,
    t(
      "Evidence / implementation links, one per line",
      "Kaynak / uygulama bağlantıları, satır başına bir",
    ),
    "textarea",
  );
  evidence.required = false;
  action(form, t("Record response", "Yanıtı kaydet"), () =>
    api("/" + id + "/events", {
      revision: r.revision,
      status: status.value,
      note: note.value,
      evidence: evidence.value
        .split("\n")
        .map((v) => v.trim())
        .filter(Boolean),
      eventId: crypto.randomUUID().replaceAll("-", ""),
    }),
  );
  if (r.submission.category !== "technical") {
    n(
      "p",
      t(
        "Scientific, source and educational contributions remain private here. Refer them to qualified humans; this desk cannot record academic acceptance or export them to GitHub.",
        "Bilimsel, kaynak ve eğitim katkıları burada özel kalır. Yetkin insan incelemesine yönlendirin; bu masa akademik kabul vermez veya bunları GitHub’a aktarmaz.",
      ),
      root,
    );
    return;
  }
  n("h3", t("GitHub publication gate", "GitHub yayın kontrolü"), root);
  n(
    "p",
    t(
      "Draft → contributor consent → a different editor’s review → download → manual issue creation. Nothing is sent automatically. Do not include names, contact details, tracking links or clinical material.",
      "Taslak → katkı sahibinin izni → farklı editörün incelemesi → indirme → elle issue açma. Otomatik gönderim yapılmaz. İsim, iletişim, özel takip bağlantısı veya klinik veri eklemeyin.",
    ),
    root,
  );
  const p = r.publication;
  if (p) {
    n("h4", p.title, root);
    n("pre", p.body, root).style.whiteSpace = "pre-wrap";
    n(
      "p",
      t("Contributor consent: ", "Katkı sahibi izni: ") +
        (p.contributorApproved ? "✓" : "—") +
        " · " +
        t("Second editor: ", "İkinci editör: ") +
        (p.editorApproved ? "✓" : "—") +
        " · " +
        (p.stale
          ? t("Outdated", "Güncelliğini yitirdi")
          : p.withdrawn
            ? t("Withdrawn", "Geri çekildi")
            : p.ready
              ? t("Ready to download", "İndirilebilir")
              : t("Waiting", "Bekliyor")),
      root,
    );
    if (!p.stale && !p.withdrawn) {
      const approval = n("form", undefined, root);
      const checked = field(
        approval,
        t(
          "I checked privacy, rights and technical scope of this exact text.",
          "Bu metnin gizlilik, haklar ve teknik kapsamını kontrol ettim.",
        ),
      );
      checked.type = "checkbox";
      action(
        approval,
        t("Approve as second editor", "İkinci editör olarak onayla"),
        () =>
          api("/" + id + "/publication", {
            revision: r.revision,
            action: "approve",
            digest: p.digest,
            checked: checked.checked,
          }),
      );
    }
    if (p.ready) {
      const download = n(
        "button",
        t("Download approved technical task", "Onaylı teknik işi indir"),
        root,
      );
      download.onclick = async () => {
        try {
          const b = await api("/" + id + "/export");
          const u = URL.createObjectURL(
            new Blob(["# " + b.title + "\n\n" + b.body], {
              type: "text/markdown",
            }),
          );
          const a = n("a");
          a.href = u;
          a.download = "approved-technical-task.md";
          a.click();
          setTimeout(() => URL.revokeObjectURL(u), 1000);
        } catch (e) {
          message.textContent = e.message;
        }
      };
      const linkForm = n("form", undefined, root);
      const link = field(
        linkForm,
        t(
          "Manually created project issue URL",
          "Elle oluşturulan proje issue bağlantısı",
        ),
      );
      link.type = "url";
      action(
        linkForm,
        t("Record issue link", "Issue bağlantısını kaydet"),
        () =>
          api("/" + id + "/publication", {
            revision: r.revision,
            action: "linked",
            digest: p.digest,
            issueUrl: link.value,
          }),
      );
    }
    if (p.issueUrl) {
      const a = n(
        "a",
        t(
          "Recorded GitHub issue (not synchronized)",
          "Kaydedilmiş GitHub issue (senkronize değil)",
        ),
        root,
      );
      a.href = p.issueUrl;
      a.target = "_blank";
      a.rel = "noreferrer noopener";
    }
  }
  const draft = n("form", undefined, root);
  n(
    "h4",
    t("Prepare a new public summary", "Yeni herkese açık özet hazırla"),
    draft,
  );
  const title = field(draft, t("English title", "İngilizce başlık"));
  title.maxLength = 160;
  title.minLength = 10;
  const summary = field(
    draft,
    t(
      "English technical summary, manually sanitized",
      "İngilizce teknik özet, kişisel bilgiler temizlenmiş",
    ),
    "textarea",
  );
  summary.maxLength = 6000;
  summary.minLength = 30;
  action(
    draft,
    t(
      "Save draft for contributor consent",
      "Katkı sahibi izni için taslağı kaydet",
    ),
    () =>
      api("/" + id + "/publication", {
        revision: r.revision,
        action: "draft",
        title: title.value,
        body: summary.value,
      }),
  );
}
async function load() {
  clear();
  const current = generation;
  message.textContent = t("Loading…", "Yükleniyor…");
  try {
    const s = await (
      await fetch("/review/api/session", {
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
      })
    ).json();
    if (document.hidden || current !== generation) return;
    if (
      !s.authenticated ||
      !(s.membership?.manager || s.membership?.intakeEditor)
    )
      throw Error(
        t(
          "A current editorial appointment and fresh sign-in are required.",
          "Güncel editör yetkisi ve yeni giriş gerekiyor.",
        ),
      );
    csrf = s.csrf;
    const ms = new Date(s.authAt).getTime() + 15 * 60000 - Date.now();
    if (ms <= 0)
      throw Error(t("Please sign in again.", "Lütfen yeniden giriş yapın."));
    expiry = setTimeout(() => {
      clear();
      message.textContent = t(
        "Sign in again to continue.",
        "Devam etmek için yeniden giriş yapın.",
      );
    }, ms);
    const data = await api();
    data.records=data.records.filter(row => (row.category==='feedback')===($("#queue-filter").value==='feedback'));
    root.hidden = false;
    n("h2", $("#queue-filter").selectedOptions[0].textContent, root);
    n("p", data.records.length + t(" active records", " aktif kayıt"), root);
    if (!data.records.length)
      n("p", t("No active contributions.", "Aktif katkı yok."), root);
    for (const row of data.records) {
      const b = n(
        "button",
        stateNames[row.status] +
          " · " +
          row.category +
          " · " +
          (row.page ? row.page+" / "+row.topic : row.structure) +
          " · " +
          new Date(row.createdAt).toLocaleDateString() +
          (row.task
            ? " · " +
              (new Date(row.task.dueAt) < new Date()
                ? t("Follow-up overdue", "Takip gecikti")
                : t("Assigned", "Sorumlu atandı"))
            : " · " + t("Unassigned", "Sorumlu bekliyor")),
        root,
      );
      b.onclick = () =>
        open(row.id).catch((e) => (message.textContent = e.message));
      n("br", undefined, root);
    }
    message.textContent = "";
  } catch (e) {
    clear();
    message.textContent = e.message;
  }
}
$("#refresh").onclick = load;
$("#queue-filter").onchange = load;
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    clear();
    message.textContent = t(
      "Private data cleared. Refresh when you return.",
      "Özel veriler temizlendi. Döndüğünüzde yenileyin.",
    );
  }
});
load();

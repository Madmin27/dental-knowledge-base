// Text-only DOM rendering: applicant-supplied content never becomes HTML.
export async function renderMembership({
  session,
  api,
  node,
  t,
  refresh,
  failure,
}) {
  const root = document.querySelector("#membership");
  root.replaceChildren();
  const roles = {
    photo_contributor: t("Photo contributor", "Fotoğraf katkıcısı"),
    privacy_reviewer: t("Privacy reviewer", "Gizlilik denetleyicisi"),
    anatomy_reviewer: t("Anatomy team applicant", "Anatomi ekibi adayı"),
  };
  const statuses = {
    pending: t("Awaiting review", "İnceleme bekliyor"),
    approved: t("Approved", "Kabul edildi"),
    rejected: t("Declined", "Reddedildi"),
    withdrawn: t("Withdrawn", "Geri çekildi"),
  };
  function field(form, label, name, type = "text", max = 2000) {
    const l = node("label", label),
      input = node(type === "textarea" ? "textarea" : "input");
    if (type !== "textarea") input.type = type;
    input.name = name;
    input.required = true;
    if (type !== "checkbox" && type !== "number") {
      input.maxLength = max;
      input.minLength = 3;
    }
    if (type === "checkbox") l.className = "check";
    l.append(input);
    form.append(l);
    return input;
  }
  function select(form, label, name, options) {
    const l = node("label", label),
      s = node("select");
    s.name = name;
    for (const [value, caption] of Object.entries(options)) {
      const o = node("option", caption);
      o.value = value;
      s.append(o);
    }
    l.append(s);
    form.append(l);
    return s;
  }
  function submit(form, label, action) {
    const b = node("button", label);
    b.type = "submit";
    form.append(b);
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      b.disabled = true;
      try {
        await action(new FormData(form));
        await refresh();
      } catch (e) {
        failure(e);
      } finally {
        b.disabled = false;
      }
    });
  }
  root.append(
    node("h2", t("Membership & applications", "Üyelik ve başvurular")),
    node(
      "p",
      t(
        "Apply to contribute photographs or join a review team. Approval records a specific role and expiry; it does not grant publication authority.",
        "Fotoğraf katkısı veya denetleyici ekibi için başvurun. Kabul, belirli ve süreli bir görev verir; yayın yetkisi vermez.",
      ),
    ),
  );
  const form = node("form");
  select(form, t("I would like to…", "Başvuru türü"), "role", roles);
  field(form, t("Full name", "Ad soyad"), "name", "text", 150);
  field(
    form,
    t("Institution / independent contributor", "Kurum / bağımsız katkıcı"),
    "institution",
    "text",
    250,
  );
  field(
    form,
    t("Relevant experience (English)", "İlgili deneyim (İngilizce)"),
    "experience",
    "textarea",
  );
  field(
    form,
    t(
      "Public professional profile or reference (no identity documents)",
      "Açık mesleki profil veya referans (kimlik belgesi eklemeyin)",
    ),
    "evidence",
    "textarea",
    1000,
  );
  field(
    form,
    t(
      "How would you like to contribute? (English)",
      "Nasıl katkı sunmak istiyorsunuz? (İngilizce)",
    ),
    "motivation",
    "textarea",
  );
  field(
    form,
    t(
      "I agree to private storage and administrator review of this application. No patient information.",
      "Başvurumun özel saklanmasına ve yöneticinin incelemesine izin veriyorum. Hasta bilgisi eklemedim.",
    ),
    "consent",
    "checkbox",
  );
  form.append(
    node(
      "p",
      t(
        "Application records are private to you and membership administrators. Contact the administrator for removal; a limited authority audit may need to remain.",
        "Başvuru kaydı size ve üyelik yöneticilerine özeldir. Silme için yöneticiyle iletişime geçin; sınırlı yetki geçmişinin korunması gerekebilir.",
      ),
      "muted",
    ),
  );
  submit(form, t("Submit application", "Başvuruyu gönder"), (d) =>
    api("applications", {
      method: "POST",
      body: JSON.stringify({
        ...Object.fromEntries(d),
        consent: d.has("consent"),
      }),
    }),
  );
  const disclosure = node("details");
  disclosure.append(
    node("summary", t("Apply for a role", "Görev başvurusu yap")),
    form,
  );
  root.append(disclosure);
  const state = session.membership;
  if (!state) return;
  root.append(node("h3", t("My applications", "Başvurularım")));
  for (const a of state.applications) {
    const card = node("article", null, "history");
    card.append(
      node("strong", roles[a.role] + " · " + statuses[a.status]),
      node("p", new Date(a.created_at).toLocaleDateString()),
    );
    if (a.reason) card.append(node("p", a.reason));
    if (a.status === "pending") {
      const f = node("form");
      submit(f, t("Withdraw", "Geri çek"), () =>
        api("applications/" + a.id + "/withdraw", { method: "POST" }),
      );
      card.append(f);
    }
    root.append(card);
  }
  if (!state.applications.length)
    root.append(node("p", t("No applications yet.", "Henüz başvuru yok.")));
  for (const g of state.permissions)
    root.append(
      node(
        "p",
        (roles[g.role] ?? g.role) +
          " · " +
          (g.revoked_at
            ? t("Revoked", "Geri alındı")
            : new Date(g.expires_at) < new Date()
              ? t("Expired", "Süresi doldu")
              : t("Active until ", "Bitiş: ")) +
          (!g.revoked_at ? new Date(g.expires_at).toLocaleDateString() : ""),
        "badge",
      ),
    );
  if (!state.manager) return;
  const management = node("section", null, "management");
  root.append(management);
  management.append(
    node("h2", t("Membership administration", "Üyelik yönetimi")),
    node(
      "p",
      t(
        "Check qualifications and conflicts before approving. Your administrator role alone cannot view private photographs. Reauthenticate after 15 minutes.",
        "Kabulden önce yeterlilik ve çıkar çatışmasını kontrol edin. Yönetici rolü tek başına özel fotoğraf erişimi vermez. 15 dakika sonra yeniden giriş gerekir.",
      ),
    ),
  );
  const intake = node("form");
  select(intake, t("Photo intake", "Fotoğraf kabulü"), "enabled", {
    false: t("Paused", "Duraklatıldı"),
    true: t("Open to authorised contributors", "Yetkili katkıcılara açık"),
  }).value = String(session.uploadsEnabled);
  field(
    intake,
    t("Reason for this change (English)", "Değişiklik gerekçesi (İngilizce)"),
    "reason",
    "textarea",
  ).minLength = 10;
  submit(intake, t("Update photo intake", "Fotoğraf kabulünü güncelle"), (d) =>
    api("management/intake", {
      method: "POST",
      body: JSON.stringify({
        enabled: d.get("enabled") === "true",
        reason: d.get("reason"),
      }),
    }),
  );
  management.append(intake);
  const queue = node("div");
  management.append(queue);
  async function load(page = 0) {
    const data = await api("management?page=" + page);
    queue.replaceChildren(
      node("h3", t("Applications · page ", "Başvurular · sayfa ") + (page + 1)),
    );
    for (const a of data.applications) {
      const card = node("article", null, "history");
      card.append(
        node("h3", a.profile.name + " · " + roles[a.role]),
        node("span", statuses[a.status], "badge"),
      );
      for (const value of [
        a.email,
        a.profile.institution,
        a.profile.experience,
        a.profile.evidence,
        a.profile.motivation,
        a.reason,
      ])
        if (value) card.append(node("p", value));
      if (a.status === "pending" && a.account_id !== session.account) {
        const f = node("form");
        select(f, t("Decision", "Karar"), "decision", {
          rejected: t("Decline", "Reddet"),
          approved: t("Approve scoped role", "Kapsamlı görevi onayla"),
        });
        const days = field(
          f,
          t("Authority duration (1–90 days)", "Yetki süresi (1–90 gün)"),
          "days",
          "number",
        );
        days.min = 1;
        days.max = 90;
        days.value = 30;
        const verified = field(
          f,
          t(
            "I verified the stated qualifications, reference and conflicts for this role.",
            "Bu görev için yeterlilik, referans ve çıkar çatışmasını kontrol ettim.",
          ),
          "verified",
          "checkbox",
        );
        verified.required = false;
        field(
          f,
          t(
            "Reason, verification reference and limits (English)",
            "Gerekçe, doğrulama referansı ve sınırlar (İngilizce)",
          ),
          "reason",
          "textarea",
        ).minLength = 10;
        submit(f, t("Record decision", "Kararı kaydet"), (d) =>
          api("applications/" + a.id + "/decision", {
            method: "POST",
            body: JSON.stringify({
              revision: a.revision,
              decision: d.get("decision"),
              days: Number(d.get("days")),
              verified: d.has("verified"),
              reason: d.get("reason"),
            }),
          }),
        );
        card.append(f);
      }
      if (a.grant_id && !a.revoked_at) {
        const f = node("form");
        field(
          f,
          t(
            "Revocation reason (English)",
            "Yetkiyi geri alma gerekçesi (İngilizce)",
          ),
          "reason",
          "textarea",
        ).minLength = 10;
        submit(f, t("Revoke authority", "Yetkiyi geri al"), (d) =>
          api("grants/" + a.grant_id + "/revoke", {
            method: "POST",
            body: JSON.stringify({ reason: d.get("reason") }),
          }),
        );
        card.append(f);
      }
      queue.append(card);
    }
    if (!data.applications.length)
      queue.append(
        node(
          "p",
          t("No applications on this page.", "Bu sayfada başvuru yok."),
        ),
      );
    for (const [label, target, enabled] of [
      [t("Previous", "Önceki"), page - 1, page > 0],
      [t("Next", "Sonraki"), page + 1, data.applications.length === 25],
    ]) {
      const b = node("button", label);
      b.disabled = !enabled;
      b.addEventListener("click", () => load(target).catch(failure));
      queue.append(b);
    }
  }
  await load();
}

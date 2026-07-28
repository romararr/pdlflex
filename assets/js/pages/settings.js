document.addEventListener("DOMContentLoaded", function () {
  const archivedList = document.getElementById("archivedList");
  const importFile = document.getElementById("importFile");

  function renderArchived() {
    const archived = PFApp.getSessions({
      includeArchived: true
    }).filter(session => session.status === "archived");

    if (!archived.length) {
      archivedList.innerHTML = `
        <div class="empty">
          <div class="empty-icon">🗃</div>
          <strong>Arsip masih kosong</strong>
          <div>Turnamen yang diarsipkan akan tampil di sini.</div>
        </div>`;
      return;
    }

    archivedList.innerHTML = archived.map(session => `
      <div class="list-item">
        <div class="list-main">
          <div class="list-title">
            ${PFUI.escapeHtml(session.setup.matchName)}
          </div>
          <div class="list-meta">
            Diarsipkan ${PFUI.formatDate(session.archivedAt)}
          </div>
        </div>

        <div class="list-actions">
          <button
            class="btn btn-soft btn-sm"
            data-action="restore"
            data-id="${session.id}">
            Pulihkan
          </button>

          <button
            class="btn btn-danger btn-sm"
            data-action="delete"
            data-id="${session.id}">
            Hapus
          </button>
        </div>
      </div>
    `).join("");
  }

  document.getElementById("exportAll").addEventListener(
    "click",
    function () {
      const root = PFApp.getRoot();

      PFUI.downloadText(
        PFStorage.exportJson(root),
        `padelflex-v4-backup-${new Date()
          .toISOString()
          .slice(0, 10)}.json`,
        "application/json"
      );

      PFUI.toast("Backup seluruh turnamen berhasil dibuat.");
    }
  );

  document.getElementById("importAll").addEventListener(
    "click",
    function () {
      importFile.click();
    }
  );

  importFile.addEventListener("change", function () {
    const file = importFile.files?.[0];

    if (!file) return;

    const reader = new FileReader();

    reader.onload = function () {
      try {
        const imported = PFStorage.importJson(
          reader.result
        );

        PFApp.replaceRoot(imported);
        PFUI.toast("Backup berhasil dipulihkan.");

        setTimeout(() => {
          location.href = "index.html";
        }, 450);
      } catch (error) {
        PFUI.toast(error.message);
      }
    };

    reader.readAsText(file);
    importFile.value = "";
  });

  document.getElementById("clearAll").addEventListener(
    "click",
    function () {
      const confirmation = prompt(
        'Ketik "HAPUS SEMUA" untuk menghapus seluruh turnamen.'
      );

      if (confirmation !== "HAPUS SEMUA") {
        PFUI.toast("Penghapusan dibatalkan.");
        return;
      }

      PFApp.clearAll();
      PFUI.toast("Seluruh data turnamen dihapus.");

      setTimeout(() => {
        location.href = "index.html";
      }, 450);
    }
  );

  archivedList.addEventListener("click", function (event) {
    const button = event.target.closest("[data-action]");
    if (!button) return;

    try {
      if (button.dataset.action === "restore") {
        PFApp.restoreSession(button.dataset.id);
        PFUI.toast("Turnamen dipulihkan.");
      }

      if (button.dataset.action === "delete") {
        const session = PFApp.getSession(button.dataset.id);

        if (
          !session ||
          !confirm(
            `Hapus permanen ${session.setup.matchName}?`
          )
        ) {
          return;
        }

        PFApp.deleteSession(button.dataset.id);
        PFUI.toast("Turnamen dihapus.");
      }

      renderArchived();
    } catch (error) {
      PFUI.toast(error.message);
    }
  });

  document.getElementById("storageKey").textContent =
    PFStorage.STORAGE_KEY;

  renderArchived();
});

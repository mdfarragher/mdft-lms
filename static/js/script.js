// Append ?next=<current path> to any login link on the page
(function () {
    var next = encodeURIComponent(window.location.pathname + window.location.search);
    ["nav-login-link", "lesson-signin-btn"].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.href = "/login?next=" + next;
    });
})();

// Shared helper: flash a copy button to "Copied" then reset
function triggerCopied(btn) {
    btn.innerHTML = '<i class="bi bi-check-lg"></i> Copied';
    btn.classList.add('copied');
    setTimeout(function () {
        btn.innerHTML = '<i class="bi bi-clipboard"></i> Copy';
        btn.classList.remove('copied');
    }, 2000);
}

// Popups only make sense when the sidebar is beside the content (Bootstrap lg, >=992px)
function popupsEnabled() {
    return window.innerWidth >= 992;
}

// Lab lesson image lightbox
document.addEventListener('DOMContentLoaded', function () {
    var modalEl = document.getElementById('labImageModal');
    if (!modalEl) return;
    var modal = new bootstrap.Modal(modalEl);
    var modalImg = document.getElementById('labImageModalImg');
    document.querySelectorAll('.lab-content img').forEach(function (img) {
        img.addEventListener('click', function () {
            if (!popupsEnabled()) return;
            modalImg.src = img.src;
            modalImg.alt = img.alt;
            modal.show();
        });
    });
});

// Code block zoom modal
document.addEventListener('DOMContentLoaded', function () {
    var codeModalEl = document.getElementById('codeZoomModal');
    if (!codeModalEl) return;
    var codeModal = new bootstrap.Modal(codeModalEl);
    var zoomCode = document.getElementById('codeZoomCode');
    var zoomCopyBtn = document.getElementById('codeZoomCopyBtn');

    // Wire up the copy button inside the modal
    zoomCopyBtn.addEventListener('click', function () {
        navigator.clipboard.writeText(zoomCode.innerText).then(function () {
            triggerCopied(zoomCopyBtn);
        });
    });

    document.querySelectorAll('.markdown-content pre').forEach(function (pre) {
        var code = pre.querySelector('code');
        if (!code) return;
        pre.addEventListener('click', function (e) {
            if (!popupsEnabled()) return;
            // Don't open modal if the copy button was clicked
            if (e.target.closest('.copy-btn')) return;
            zoomCode.innerHTML = code.innerHTML;
            zoomCode.className = code.className;
            codeModal.show();
        });
    });
});

// Copy buttons for code blocks and prompt callouts
document.addEventListener('DOMContentLoaded', function () {
    function makeCopyBtn() {
        var btn = document.createElement('button');
        btn.className = 'copy-btn';
        btn.setAttribute('aria-label', 'Copy to clipboard');
        btn.innerHTML = '<i class="bi bi-clipboard"></i> Copy';
        return btn;
    }

    // Code blocks: copy innerText of <code> (strips highlight spans)
    document.querySelectorAll('.markdown-content pre').forEach(function (pre) {
        var code = pre.querySelector('code');
        if (!code) return;
        var btn = makeCopyBtn();
        btn.addEventListener('click', function () {
            navigator.clipboard.writeText(code.innerText).then(function () {
                triggerCopied(btn);
            });
        });
        pre.appendChild(btn);
    });

    // Prompt callouts: copy innerText of <em>
    document.querySelectorAll('.prompt-callout').forEach(function (callout) {
        var em = callout.querySelector('em');
        if (!em) return;
        var btn = makeCopyBtn();
        btn.addEventListener('click', function () {
            navigator.clipboard.writeText(em.innerText).then(function () {
                triggerCopied(btn);
            });
        });
        callout.appendChild(btn);
    });
});

// Quiz: disable the submit button until an answer is selected
(function () {
    var toggle = document.querySelector('.quiz-submitted-toggle');
    if (!toggle) return;
    var submitBtn = document.querySelector('.quiz-submit-btn');
    if (!submitBtn) return;
    submitBtn.classList.add('disabled');
    document.querySelectorAll('.quiz-radio[type="radio"]').forEach(function (radio) {
        radio.addEventListener('change', function () {
            submitBtn.classList.remove('disabled');
        });
    });
})();

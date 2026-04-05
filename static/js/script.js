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

// Quiz: disable the submit button until an answer is selected (single-answer)
(function () {
    var toggle = document.querySelector('.quiz-submitted-toggle');
    if (!toggle) return;
    var submitBtn = document.querySelector('.quiz-submit-btn');
    if (!submitBtn) return;
    var radios = document.querySelectorAll('.quiz-radio[type="radio"]');
    if (radios.length === 0) return;
    submitBtn.classList.add('disabled');
    radios.forEach(function (radio) {
        radio.addEventListener('change', function () {
            submitBtn.classList.remove('disabled');
        });
    });
})();

// Quiz: disable the submit button until at least one answer is selected (multiple-answer)
// Also handle submission feedback in JS, since CSS :has() cannot count correct answers.
(function () {
    var container = document.querySelector('.quiz-multiple-container');
    if (!container) return;
    var submitBtn = container.querySelector('.quiz-submit-btn');
    if (!submitBtn) return;
    var checkboxes = container.querySelectorAll('.quiz-checkbox[type="checkbox"]');
    if (checkboxes.length === 0) return;
    var toggle = container.querySelector('.quiz-submitted-toggle');
    var feedbackCorrect = container.querySelector('.quiz-feedback-correct');
    var feedbackIncorrect = container.querySelector('.quiz-feedback-incorrect');

    // Start disabled
    submitBtn.classList.add('disabled');

    // Enable/disable submit as selections change
    checkboxes.forEach(function (checkbox) {
        checkbox.addEventListener('change', function () {
            var anyChecked = Array.prototype.some.call(checkboxes, function (cb) {
                return cb.checked;
            });
            submitBtn.classList.toggle('disabled', !anyChecked);
        });
    });

    // On submission: evaluate correctness and show the right feedback panel
    submitBtn.addEventListener('click', function () {
        // Wait a tick for the toggle checkbox state to update
        setTimeout(function () {
            if (!toggle.checked) return;

            var totalCorrect = container.querySelectorAll('.quiz-answer-wrap.is-correct').length;
            var checkedCorrect = container.querySelectorAll('.quiz-answer-wrap.is-correct .quiz-checkbox:checked').length;
            var checkedIncorrect = container.querySelectorAll('.quiz-answer-wrap.is-incorrect .quiz-checkbox:checked').length;
            var allCorrectSelected = checkedCorrect === totalCorrect && checkedIncorrect === 0;

            if (feedbackCorrect)  feedbackCorrect.style.display  = allCorrectSelected ? 'block' : 'none';
            if (feedbackIncorrect) feedbackIncorrect.style.display = allCorrectSelected ? 'none'  : 'block';
        }, 0);
    });
})();

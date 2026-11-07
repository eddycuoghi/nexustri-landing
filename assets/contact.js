/* NexusTri — contact form: accessible validation and submission to Netlify Forms.
   Without JavaScript the browser validates the required fields and posts the form directly;
   Netlify Forms then shows /contact-sent. This only works once Netlify form detection is enabled
   for the site and the form has been detected at deploy time.
   A successful HTTP response means the server accepted the request. It is not, by itself, proof
   that the submission was stored or that a notification was delivered: verify those in Netlify. */
(() => {
  'use strict';

  const form = document.querySelector('form.contact-form');
  if (!form || !window.fetch || !window.URLSearchParams || !window.FormData) return;

  form.noValidate = true; // replaced by the accessible messages below
  const status = document.getElementById('form-status');
  const submit = form.querySelector('[type="submit"]');
  const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const SUPPORT = '<a href="mailto:support@nexustri.com"><span translate="no" class="notranslate">support@nexustri.com</span></a>';
  const TIMEOUT_MS = 15000; // a request still pending after this is treated as failed

  const checks = {
    name: (v) => (v.trim() ? '' : 'Please enter your name.'),
    email: (v) => {
      if (!v.trim()) return 'Please enter your email address.';
      return EMAIL.test(v.trim()) ? '' : 'Please enter a valid email address, for example name@example.com.';
    },
    subject: (v) => (v ? '' : 'Please choose a subject.'),
    message: (v) => {
      const len = v.trim().length;
      if (!len) return 'Please enter your message.';
      if (len < 10) return 'Please write a little more (at least 10 characters).';
      return len > 5000 ? 'Please shorten your message to 5,000 characters or fewer.' : '';
    },
  };

  const fieldError = (input, message) => {
    const error = document.getElementById(input.id + '-error');
    if (message) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
    if (error) {
      error.textContent = message;
      error.hidden = !message;
    }
  };

  const validate = () => {
    const errors = [];
    Object.keys(checks).forEach((name) => {
      const input = form.elements[name];
      const message = checks[name](input.value);
      fieldError(input, message);
      if (message) errors.push({ input, message });
    });
    return errors;
  };

  const showStatus = (html) => {
    status.innerHTML = html;
    status.hidden = false;
    status.focus();
  };

  let attempted = false;
  form.addEventListener('input', (e) => {
    const name = e.target.name;
    if (attempted && checks[name]) fieldError(e.target, checks[name](e.target.value));
  });
  form.addEventListener('change', (e) => {
    const name = e.target.name;
    if (attempted && checks[name]) fieldError(e.target, checks[name](e.target.value));
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    attempted = true;
    const errors = validate();
    if (errors.length) {
      const items = errors.map((err) => `<li><a href="#${err.input.id}">${err.message}</a></li>`).join('');
      showStatus(`<p><strong>Please check the form.</strong> ${errors.length === 1 ? 'One field needs' : errors.length + ' fields need'} your attention:</p><ul>${items}</ul>`);
      return;
    }

    status.hidden = true;
    submit.disabled = true;
    const label = submit.textContent;
    submit.textContent = 'Sending…';

    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    let timedOut = false;
    let timer = null;
    const deadline = new Promise((resolve, reject) => {
      timer = window.setTimeout(() => {
        timedOut = true;
        if (controller) controller.abort();
        reject(new Error('timeout'));
      }, TIMEOUT_MS);
    });

    try {
      const body = new URLSearchParams(new FormData(form)).toString();
      const res = await Promise.race([
        fetch('/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body,
          signal: controller ? controller.signal : undefined,
        }),
        deadline,
      ]);
      window.clearTimeout(timer);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      // The server accepted the submission (HTTP 2xx): show the confirmation page.
      window.location.assign(form.getAttribute('action') || '/contact-sent');
    } catch (err) {
      window.clearTimeout(timer);
      // The entered information stays in the form so it can be sent again.
      submit.disabled = false;
      submit.textContent = label;
      showStatus(timedOut
        ? `<p><strong>We could not confirm that your message was sent.</strong> The server took too long to respond. Your message is still in the form: please try again, or email us at ${SUPPORT}.</p>`
        : `<p><strong>Your message could not be sent.</strong> Your message is still in the form: please try again in a moment, or email us at ${SUPPORT}.</p>`);
    }
  });

  // Links in the error summary move focus to the field.
  status.addEventListener('click', (e) => {
    const link = e.target.closest('a[href^="#"]');
    if (!link) return;
    const target = document.getElementById(link.getAttribute('href').slice(1));
    if (target) {
      e.preventDefault();
      target.focus();
    }
  });
})();

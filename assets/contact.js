/* NexusTri — contact form: accessible validation and submission to Netlify Forms.
   Without JavaScript the form still works: the browser validates the required fields and
   posts the form directly to Netlify, which shows /contact-sent after a successful submission. */
(() => {
  'use strict';

  const form = document.querySelector('form.contact-form');
  if (!form || !window.fetch || !window.URLSearchParams || !window.FormData) return;

  form.noValidate = true; // replaced by the accessible messages below
  const status = document.getElementById('form-status');
  const submit = form.querySelector('[type="submit"]');
  const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const SUPPORT = '<a href="mailto:support@nexustri.com"><span translate="no" class="notranslate">support@nexustri.com</span></a>';

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

    try {
      const body = new URLSearchParams(new FormData(form)).toString();
      const res = await fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      // Only a successful response from the form handler leads to the confirmation page.
      window.location.assign(form.getAttribute('action') || '/contact-sent');
    } catch (err) {
      submit.disabled = false;
      submit.textContent = label;
      showStatus(`<p><strong>Your message could not be sent.</strong> Please try again in a moment, or email us at ${SUPPORT}.</p>`);
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

<template>
  <main class="card login">
    <header class="app-header login-header">
      <h1>ברוכים הבאים</h1>
      <p>הזינו קוד גישה כדי להמשיך</p>
    </header>

    <div class="login-body">
      <form class="login-form" @submit.prevent="submit">
        <div class="login-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
            <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
            <circle cx="12" cy="15.5" r="1.2" fill="currentColor" stroke="none" />
          </svg>
        </div>
        <h2 class="login-title">כניסה למערכת</h2>

        <label class="login-label" for="passcode">קוד גישה</label>
        <input
          id="passcode"
          ref="input"
          v-model="passcode"
          type="password"
          autocomplete="current-password"
          placeholder="••••••"
          :aria-invalid="Boolean(error)"
          :disabled="isLoading"
        />
        <p class="login-error" role="alert">{{ error }}</p>
        <button type="submit" class="login-btn" :disabled="isLoading || !passcode">
          <span v-if="isLoading" class="login-spinner" aria-hidden="true"></span>
          {{ isLoading ? "מתחבר…" : "כניסה" }}
        </button>
      </form>
    </div>
  </main>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useAuth } from "../lib/auth.js";

const router = useRouter();
const { login, isLoading } = useAuth();
const passcode = ref("");
const error = ref("");
const input = ref(null);

onMounted(() => input.value?.focus());

async function submit() {
  error.value = "";
  const result = await login(passcode.value.trim());
  if (result.ok) {
    router.push({ name: "main" });
  } else {
    error.value = result.error;
    passcode.value = "";
    input.value?.focus();
  }
}
</script>

<style scoped>
.login-body {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px 18px;
  overflow-y: auto;
}
.login-form {
  width: 100%;
  max-width: 340px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.login-icon {
  width: 68px;
  height: 68px;
  margin: 0 auto 4px;
  display: grid;
  place-items: center;
  color: var(--primary-ink);
  background: linear-gradient(135deg, var(--primary-light), var(--primary-dark));
  border-radius: 50%;
  box-shadow: var(--shadow-md);
}
.login-title { margin: 0 0 14px; text-align: center; font-size: 1.25rem; color: var(--primary-dark); }
.login-label { font-weight: 700; color: var(--primary-dark); }
.login-form input {
  min-height: 48px;
  padding: 0 14px;
  font: inherit;
  font-size: 1.1rem;
  letter-spacing: .25em;
  text-align: center;
  background: #fff;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  box-shadow: var(--shadow-sm);
  transition: border-color var(--ease), box-shadow var(--ease);
}
.login-form input::placeholder { letter-spacing: .25em; color: var(--line); }
.login-form input:focus-visible {
  outline: none;
  border-color: var(--primary-light);
  box-shadow: 0 0 0 3px rgba(44, 125, 149, .25);
}
.login-form input[aria-invalid="true"] { border-color: var(--danger); }
.login-error {
  min-height: 1.4em;
  margin: 0;
  text-align: center;
  color: var(--danger);
  font-weight: 600;
}
.login-btn {
  min-height: 48px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font: inherit;
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--primary-ink);
  background: linear-gradient(135deg, var(--primary-light), var(--primary));
  border: 0;
  border-radius: var(--radius);
  box-shadow: var(--shadow-sm);
  cursor: pointer;
  transition: transform var(--ease), box-shadow var(--ease), opacity var(--ease);
}
.login-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: var(--shadow-md); }
.login-btn:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
.login-btn:disabled { opacity: .55; cursor: not-allowed; }
.login-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, .4);
  border-top-color: #fff;
  border-radius: 50%;
  animation: login-spin .7s linear infinite;
}
@keyframes login-spin { to { transform: rotate(360deg); } }
</style>

import { z } from 'zod'
import { supabase } from '@/lib/supabase'
import { navigate } from '@/router'
import { toast } from '@/lib/toast'

const schema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

export function mountAuthPage(container: HTMLElement): () => void {
  const page = document.createElement('div')
  page.className = 'page-auth'

  page.innerHTML = `
    <div class="auth-card">
      <h1 class="auth-title">Eagle Maps</h1>
      <p class="auth-subtitle">Sign in to add restaurants to the map</p>

      <div class="auth-tabs">
        <button class="auth-tab active" data-tab="login">Login</button>
        <button class="auth-tab" data-tab="signup">Sign up</button>
      </div>

      <!-- Login form -->
      <div class="auth-tab-content active" id="tab-login">
        <form id="form-login">
          <div class="form-group">
            <label class="form-label" for="login-email">Email</label>
            <input id="login-email" name="email" type="email" class="form-input" autocomplete="email" />
            <span class="form-error" id="login-err-email"></span>
          </div>
          <div class="form-group">
            <label class="form-label" for="login-password">Password</label>
            <input id="login-password" name="password" type="password" class="form-input" autocomplete="current-password" />
            <span class="form-error" id="login-err-password"></span>
          </div>
          <span class="form-error" id="login-err-general"></span>
          <button type="submit" class="btn btn-primary" style="width:100%;margin-top:8px" id="login-submit">Sign in</button>
        </form>
      </div>

      <!-- Signup form -->
      <div class="auth-tab-content" id="tab-signup">
        <form id="form-signup">
          <div class="form-group">
            <label class="form-label" for="signup-email">Email</label>
            <input id="signup-email" name="email" type="email" class="form-input" autocomplete="email" />
            <span class="form-error" id="signup-err-email"></span>
          </div>
          <div class="form-group">
            <label class="form-label" for="signup-password">Password</label>
            <input id="signup-password" name="password" type="password" class="form-input" autocomplete="new-password" />
            <span class="form-error" id="signup-err-password"></span>
          </div>
          <span class="form-error" id="signup-err-general"></span>
          <button type="submit" class="btn btn-primary" style="width:100%;margin-top:8px" id="signup-submit">Create account</button>
        </form>
      </div>
    </div>
  `

  container.appendChild(page)

  // ─── Tab switching ────────────────────────────────────────────────────────────
  const tabs = page.querySelectorAll<HTMLButtonElement>('.auth-tab')
  const contents = page.querySelectorAll<HTMLElement>('.auth-tab-content')

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab!
      tabs.forEach((t) => t.classList.toggle('active', t.dataset.tab === target))
      contents.forEach((c) => c.classList.toggle('active', c.id === `tab-${target}`))
      // Clear all errors on tab switch
      page.querySelectorAll('.form-error').forEach((el) => (el.textContent = ''))
    })
  })

  // ─── Shared form handler ─────────────────────────────────────────────────────
  function clearErrors(prefix: string): void {
    page.querySelectorAll(`[id^="${prefix}-err"]`).forEach((el) => (el.textContent = ''))
  }

  function showFieldErrors(prefix: string, issues: z.ZodIssue[]): void {
    issues.forEach((issue) => {
      const field = String(issue.path[0])
      const el = page.querySelector(`#${prefix}-err-${field}`)
      if (el) el.textContent = issue.message
    })
  }

  // ─── Login ────────────────────────────────────────────────────────────────────
  const loginForm = page.querySelector<HTMLFormElement>('#form-login')!
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault()
    clearErrors('login')

    const fd = new FormData(loginForm)
    const result = schema.safeParse({ email: fd.get('email'), password: fd.get('password') })

    if (!result.success) {
      showFieldErrors('login', result.error.issues)
      return
    }

    const submitBtn = page.querySelector<HTMLButtonElement>('#login-submit')!
    submitBtn.disabled = true
    submitBtn.textContent = 'Signing in…'

    const { error } = await supabase.auth.signInWithPassword(result.data)
    if (error) {
      page.querySelector('#login-err-general')!.textContent = error.message
      submitBtn.disabled = false
      submitBtn.textContent = 'Sign in'
      return
    }

    toast.success('Welcome back!')
    navigate('/')
  })

  // ─── Signup ───────────────────────────────────────────────────────────────────
  const signupForm = page.querySelector<HTMLFormElement>('#form-signup')!
  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault()
    clearErrors('signup')

    const fd = new FormData(signupForm)
    const result = schema.safeParse({ email: fd.get('email'), password: fd.get('password') })

    if (!result.success) {
      showFieldErrors('signup', result.error.issues)
      return
    }

    const submitBtn = page.querySelector<HTMLButtonElement>('#signup-submit')!
    submitBtn.disabled = true
    submitBtn.textContent = 'Creating account…'

    const { error } = await supabase.auth.signUp(result.data)
    if (error) {
      page.querySelector('#signup-err-general')!.textContent = error.message
      submitBtn.disabled = false
      submitBtn.textContent = 'Create account'
      return
    }

    toast.success('Account created! Welcome to Eagle Maps.')
    navigate('/')
  })

  return () => {
    container.innerHTML = ''
  }
}

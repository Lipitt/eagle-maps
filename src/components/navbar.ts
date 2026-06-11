import { navigate } from '@/router'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

export interface NavbarHandle {
  el: HTMLElement
  update(user: User | null): void
}

export function createNavbar(parent: HTMLElement): NavbarHandle {
  const el = document.createElement('div')
  el.className = 'navbar'

  const title = document.createElement('span')
  title.className = 'navbar-title'
  title.textContent = 'Eagle Maps'

  const actions = document.createElement('div')
  actions.className = 'navbar-actions'

  el.appendChild(title)
  el.appendChild(actions)
  parent.appendChild(el)

  function update(user: User | null): void {
    actions.innerHTML = ''
    if (user) {
      const email = document.createElement('span')
      email.className = 'navbar-email'
      email.textContent = user.email ?? ''

      const signOutBtn = document.createElement('button')
      signOutBtn.className = 'btn btn-outline btn-sm'
      signOutBtn.textContent = 'Sign out'
      signOutBtn.addEventListener('click', () => supabase.auth.signOut())

      actions.appendChild(email)
      actions.appendChild(signOutBtn)
    } else {
      const signInBtn = document.createElement('button')
      signInBtn.className = 'btn btn-primary btn-sm'
      signInBtn.textContent = 'Sign in'
      signInBtn.addEventListener('click', () => navigate('/auth'))
      actions.appendChild(signInBtn)
    }
  }

  return { el, update }
}

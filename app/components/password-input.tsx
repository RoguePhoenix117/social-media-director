import { Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'

type PasswordInputProps = Omit<React.ComponentProps<'input'>, 'type'>

export function PasswordInput({ className, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false)

  return (
    <div className={`password-input${className ? ` ${className}` : ''}`}>
      <input {...props} type={visible ? 'text' : 'password'} />
      <button
        aria-label={visible ? 'Hide password' : 'Show password'}
        className="password-input-toggle"
        onClick={() => setVisible((current) => !current)}
        tabIndex={-1}
        type="button"
      >
        {visible ? <EyeOff aria-hidden="true" size={18} /> : <Eye aria-hidden="true" size={18} />}
      </button>
    </div>
  )
}

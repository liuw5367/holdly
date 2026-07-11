import { z } from 'zod'

export const updatePasswordSchema = z
  .object({
    mode: z.enum(['change', 'recovery']),
    oldPassword: z.string().optional(),
    password: z.string().min(1, '请输入新密码').min(8, '密码至少 8 位'),
    confirmPassword: z.string().min(1, '请确认密码'),
  })
  .superRefine((value, context) => {
    if (value.mode === 'change' && !value.oldPassword) {
      context.addIssue({ code: 'custom', message: '请输入旧密码', path: ['oldPassword'] })
    }
    if (value.password !== value.confirmPassword) {
      context.addIssue({ code: 'custom', message: '两次输入的密码不一致', path: ['confirmPassword'] })
    }
  })

import { createFileRoute } from '@tanstack/react-router'
import { TemplateSettingsPage } from '../components/template-pages'

export const Route = createFileRoute('/settings')({
  component: TemplateSettingsPage,
})

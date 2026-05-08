import { createFileRoute } from '@tanstack/react-router'
import { TemplatePlaceholderPage } from '../components/template-pages'

export const Route = createFileRoute('/draft')({
  component: () => <TemplatePlaceholderPage routeName="Draft" />,
})

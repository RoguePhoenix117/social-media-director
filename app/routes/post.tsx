import { createFileRoute } from '@tanstack/react-router'
import { TemplatePostPage } from '../components/template-pages'

export const Route = createFileRoute('/post')({
  component: TemplatePostPage,
})

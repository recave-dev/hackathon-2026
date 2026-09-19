import { createFileRoute } from '@tanstack/react-router'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Hackathon 2026 <Badge>shadcn + Base UI</Badge>
          </CardTitle>
          <CardDescription>
            Edytuj <code>src/routes/index.tsx</code>, żeby zacząć.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Tabs defaultValue="one">
            <TabsList>
              <TabsTrigger value="one">Formularz</TabsTrigger>
              <TabsTrigger value="two">Przyciski</TabsTrigger>
            </TabsList>
            <TabsContent value="one" className="flex flex-col gap-3 pt-3">
              <Input placeholder="Wpisz coś..." />
              <label className="flex items-center gap-2 text-sm">
                <Switch /> Tryb turbo
              </label>
            </TabsContent>
            <TabsContent value="two" className="flex flex-wrap gap-2 pt-3">
              <Button>Default</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="destructive">Destructive</Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}

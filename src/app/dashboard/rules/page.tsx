
"use client"

import { useState } from "react"
import { Plus, Settings2, ShieldCheck, AlertCircle, Trash2, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, doc, deleteDoc } from "firebase/firestore"
import { setDocumentNonBlocking } from "@/firebase/non-blocking-updates"
import { useToast } from "@/hooks/use-toast"

export default function RulesPage() {
  const { toast } = useToast()
  const db = useFirestore()
  const rulesRef = useMemoFirebase(() => collection(db, "schedulingRules"), [db])
  const { data: rules, isLoading } = useCollection<{ name: string }>(rulesRef)

  const [newRule, setNewRule] = useState("")

  const addRule = () => {
    if (newRule.trim()) {
      const id = `rule-${Date.now()}`
      setDocumentNonBlocking(doc(db, "schedulingRules", id), { name: newRule.trim() }, { merge: true })
      setNewRule("")
      toast({ title: "Rule Added", description: "Constraint successfully saved to database." })
    }
  }

  const removeRule = (id: string) => {
    deleteDoc(doc(db, "schedulingRules", id))
    toast({ title: "Rule Removed", description: "Constraint deleted." })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="flex-1 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight font-headline">Scheduling Rules</h2>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Settings2 className="h-5 w-5 text-primary" />
              <CardTitle className="font-headline">Global Constraints</CardTitle>
            </div>
            <CardDescription>
              These rules guide the AI generator. More specific rules lead to higher quality, conflict-free schedules.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex gap-2">
              <Input 
                placeholder="e.g., Practical units must be scheduled after 10 AM" 
                value={newRule}
                onChange={(e) => setNewRule(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addRule()}
              />
              <Button onClick={addRule}>
                <Plus className="h-4 w-4 mr-2" /> Add Rule
              </Button>
            </div>

            <div className="space-y-3">
              {rules?.map((rule) => (
                <div key={rule.id} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <ShieldCheck className="h-4 w-4 text-green-500" />
                    <span className="text-sm font-medium">{rule.name}</span>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => removeRule(rule.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            {(!rules || rules.length === 0) && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>No rules defined</AlertTitle>
                <AlertDescription>
                  The AI will generate a schedule without additional constraints. Conflicts may occur more frequently.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

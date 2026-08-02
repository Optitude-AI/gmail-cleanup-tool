'use client'

import { Wand2, Rocket, Target } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RISK_COLORS } from '@/components/app/constants'
import type { CleanupStep } from '@/lib/types'

interface WizardTabProps {
  wizardTarget: number
  wizardPlan: any | null
  wizardLoading: boolean
  onTargetChange: (v: number) => void
  onGenerate: () => void
  onViewFiles: (fileIds: string[]) => void
}

export function WizardTab({ wizardTarget, wizardPlan, wizardLoading, onTargetChange, onGenerate, onViewFiles }: WizardTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Wand2 className="h-5 w-5 text-purple-500" />Smart Cleanup Wizard</CardTitle>
        <CardDescription>Choose how much space you want to free. The wizard will create the safest possible plan.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <Label className="text-sm font-medium whitespace-nowrap">Free up:</Label>
          <div className="flex items-center gap-2">
            <Button variant={wizardTarget === 0.5 ? 'default' : 'outline'} size="sm" onClick={() => onTargetChange(0.5)}>500 MB</Button>
            <Button variant={wizardTarget === 1 ? 'default' : 'outline'} size="sm" onClick={() => onTargetChange(1)}>1 GB</Button>
            <Button variant={wizardTarget === 2 ? 'default' : 'outline'} size="sm" onClick={() => onTargetChange(2)}>2 GB</Button>
            <Button variant={wizardTarget === 5 ? 'default' : 'outline'} size="sm" onClick={() => onTargetChange(5)}>5 GB</Button>
            <Input type="number" value={wizardTarget} onChange={e => onTargetChange(Number(e.target.value) || 1)} className="w-20" />
            <span className="text-sm text-muted-foreground">GB</span>
          </div>
          <Button onClick={onGenerate} disabled={wizardLoading} className="gap-2 ml-auto"><Rocket className="h-4 w-4" />{wizardLoading ? 'Planning...' : 'Generate Plan'}</Button>
        </div>
        {wizardPlan && (
          <div className="space-y-3 mt-4">
            <div className="flex items-center gap-4 p-3 rounded-lg bg-purple-50 dark:bg-purple-950/30 border border-purple-200">
              <Target className="h-5 w-5 text-purple-500" />
              <div><p className="text-sm font-semibold">Can free up to {wizardPlan.totalCanBeFreedFormatted}</p><p className="text-xs text-muted-foreground">Target: {wizardPlan.targetFormatted} &middot; Estimated time: {wizardPlan.estimatedTime}</p></div>
            </div>
            <div className="space-y-2">
              {wizardPlan.steps.map((step: CleanupStep) => (
                <Card key={step.id} className="border-slate-200 dark:border-slate-700">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 shrink-0"><span className="text-xs font-bold">{step.order}</span></div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold">{step.action}</span>
                          <Badge className={`text-[10px] px-1.5 ${RISK_COLORS[step.risk] || ''}`}>{step.risk}</Badge>
                          <Badge variant="outline" className="text-[10px]">{step.spaceFreedFormatted}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{step.description}</p>
                        <p className="text-xs text-muted-foreground mt-1">{step.riskExplanation}</p>
                      </div>
                      <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => onViewFiles(step.fileIds)}>View</Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
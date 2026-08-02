'use client'

import { useState } from 'react'
import { HardDrive, Gauge, Mail, Camera, Wand2, Shield, LogIn, Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'

interface AuthScreenProps {
  error: string | null
  isConnecting: boolean
  authUrl: string
  authCode: string
  onStartOAuth: () => void
  onAuthCodeChange: (code: string) => void
  onCodeSubmit: () => void
}

export function AuthScreen({ error, isConnecting, authUrl, authCode, onStartOAuth, onAuthCodeChange, onCodeSubmit }: AuthScreenProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="container mx-auto max-w-2xl px-4 py-16">
        <div className="flex flex-col items-center gap-8 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-red-500 to-orange-500 shadow-lg">
            <HardDrive className="h-10 w-10 text-white" />
          </div>
          <div className="space-y-3">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl">Google Cleanup Tool</h1>
            <p className="text-lg text-slate-600 dark:text-slate-400 max-w-lg">Clean up Gmail, Drive &amp; Photos with smart suggestions, backup-before-delete, scheduled cleanup, and AI-powered insights.</p>
          </div>
          <div className="grid gap-4 w-full max-w-lg sm:grid-cols-5">
            {[
              { icon: <Gauge className="h-5 w-5" />, t: 'Unified', d: 'Cross-service storage gauge' },
              { icon: <Mail className="h-5 w-5" />, t: 'Gmail', d: 'Unsubscribe & bulk delete' },
              { icon: <HardDrive className="h-5 w-5" />, t: 'Drive', d: 'Large files & duplicates' },
              { icon: <Camera className="h-5 w-5" />, t: 'Photos', d: 'Photo storage management' },
              { icon: <Wand2 className="h-5 w-5" />, t: 'Smart', d: 'AI wizard & scheduling' },
            ].map(i => (
              <div key={i.t} className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-3">
                <div className="text-orange-500">{i.icon}</div>
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">{i.t}</span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">{i.d}</span>
              </div>
            ))}
          </div>
          <Card className="w-full max-w-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5 text-red-500" />Connect Your Google Account</CardTitle>
              <CardDescription>Secure OAuth2 access to Gmail, Drive, and Photos.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
              <Button onClick={onStartOAuth} disabled={isConnecting} className="w-full h-12 text-base font-semibold" size="lg">
                {isConnecting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <LogIn className="mr-2 h-5 w-5" />}{isConnecting ? 'Connecting...' : 'Connect with Google'}
              </Button>
              {authUrl && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground"><Separator className="flex-1" /><span>or paste authorization code</span><Separator className="flex-1" /></div>
                  <div className="flex gap-2"><Input value={authCode} onChange={e => onAuthCodeChange(e.target.value)} placeholder="Paste the authorization code..." className="flex-1" /><Button onClick={onCodeSubmit} disabled={!authCode.trim() || isConnecting}>Verify</Button></div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

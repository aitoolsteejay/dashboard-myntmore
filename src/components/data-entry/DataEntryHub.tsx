import React, { useState } from 'react'
import { Users, Globe, Star, TrendingUp, Settings2 } from 'lucide-react'
import { DataEntryPage } from './DataEntryPage'
import { MMContentPage } from '../mm/MMContentPage'
import { TJPersonalBrandPage } from '../tj-brand/TJBrandPage'
import { SalesOutreachPage } from '../sales/SalesPage'
import { ProcessesPage } from '../processes/ProcessesPage'

type Section = 'client' | 'mm' | 'tj' | 'sales' | 'processes'

const sections: { id: Section; label: string; icon: React.ElementType }[] = [
  { id: 'client',    label: 'Client Data Entry',  icon: Users      },
  { id: 'mm',        label: 'MM Content',          icon: Globe      },
  { id: 'tj',        label: 'TJ Personal Brand',   icon: Star       },
  { id: 'sales',     label: 'Sales & Outreach',    icon: TrendingUp },
  { id: 'processes', label: 'Processes',           icon: Settings2  },
]

export function DataEntryHub() {
  const [active, setActive] = useState<Section>('client')

  return (
    <div className="min-h-screen bg-background">
      {/* Section Switcher */}
      <div className="border-b bg-card sticky top-14 z-10">
        <div className="px-6 pt-5 pb-0">
          <h1 className="text-xl font-bold tracking-tight mb-4">Data Entry</h1>
          <div className="flex gap-1 flex-wrap">
            {sections.map((s) => {
              const isActive = active === s.id
              return (
                <button
                  key={s.id}
                  onClick={() => setActive(s.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-md border-b-2 transition-all ${
                    isActive
                      ? 'border-gold text-foreground bg-gold/5'
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
                >
                  <s.icon className={`h-4 w-4 ${isActive ? 'text-gold' : ''}`} />
                  {s.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Section Content */}
      <div>
        {active === 'client'    && <DataEntryPage />}
        {active === 'mm'        && <MMContentPage embedded />}
        {active === 'tj'        && <TJPersonalBrandPage embedded />}
        {active === 'sales'     && <SalesOutreachPage embedded />}
        {active === 'processes' && <ProcessesPage embedded />}
      </div>
    </div>
  )
}

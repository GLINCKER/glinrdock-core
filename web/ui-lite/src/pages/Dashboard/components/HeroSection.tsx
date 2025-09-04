interface HeroSectionProps {
  planInfo?: any
}

export function HeroSection({ planInfo }: HeroSectionProps) {
  return (
    <div class="relative overflow-hidden">
      <div class="absolute inset-0 bg-gradient-to-br from-[#ffaa40]/5 via-[#9c40ff]/5 to-[#8b008b]/5 rounded-2xl"></div>
      <div class="relative p-8 rounded-2xl border border-gray-200/20 dark:border-gray-700/20">
        <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div>
            <h1 class="text-3xl lg:text-4xl font-bold mb-3">
              <span class="bg-gradient-to-r from-[#ffaa40] via-[#9c40ff] to-[#8b008b] bg-clip-text text-transparent">
                Welcome to GLINRDOCK
              </span>
            </h1>
            <p class="text-gray-600 dark:text-gray-300 text-lg mb-4">
              Your powerful Platform as a Service infrastructure at a glance
            </p>
            <div class="flex flex-wrap items-center gap-4">
              <div class="flex items-center space-x-2 px-3 py-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full border border-emerald-500/20">
                <div class="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                <span class="text-sm font-medium">System Online</span>
              </div>
              {planInfo && (
                <div class="flex items-center space-x-2 px-3 py-1.5 bg-[#9c40ff]/10 text-[#9c40ff] rounded-full border border-[#9c40ff]/20">
                  <span class="text-sm font-medium">{planInfo.plan_name} Plan</span>
                </div>
              )}
            </div>
          </div>
          <div class="flex-shrink-0">
            <div class="w-32 h-32 bg-gradient-to-br from-[#ffaa40] via-[#9c40ff] to-[#8b008b] rounded-3xl flex items-center justify-center shadow-2xl shadow-[#9c40ff]/25">
              <svg class="w-16 h-16 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
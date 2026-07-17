<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  Palette, Check, FileCode, ShieldCheck,
} from 'lucide-vue-next';
import { dashboardApi, type BrandSettings, type VersionInfo } from '@/api/dashboard';
import { toApiError } from '@/api/client';
import { useBrandStore } from '@/stores/brand';

const { t } = useI18n();
const brand = useBrandStore();
const form = ref<BrandSettings | null>(null);
const saveFinished = ref(false);
const saveError = ref<string | null>(null);
const logoFile = ref<File | null>(null);
const version = ref<VersionInfo | null>(null);
// Logo preview URL — tracks the configured logo; null (→ FileCode icon) when
// no logo is configured or the image fails to load.
const logoPreviewUrl = ref<string | null>(null);
const logoName = computed(() => logoFile.value?.name ?? form.value?.logoPath?.split('/').pop() ?? 'logo.svg');

const themeColors = [
  { name: 'Blue', hex: '#0E48D8' },
  { name: 'Green', hex: '#00644e' },
  { name: 'Red', hex: '#ba1a1a' },
  { name: 'Purple', hex: '#5c5d6f' },
  { name: 'Dark', hex: '#202124' },
];

onMounted(async () => {
  const [settings, currentVersion] = await Promise.all([
    dashboardApi.getSettings(),
    dashboardApi.version(),
  ]);
  version.value = currentVersion;
  form.value = settings;
  logoPreviewUrl.value = brand.c.logoUrl;
});

async function saveConfig() {
  if (!form.value) return;
  saveError.value = null;
  try {
    const updated = await dashboardApi.updateSettings({
      siteName: form.value.siteName,
      themeColor: form.value.themeColor,
    });
    form.value = updated;
    // Reflect into the brand store + re-apply theme so the sidebar/header update live.
    brand.config = {
      ...brand.c,
      siteName: updated.siteName,
      logoUrl: brand.c.logoUrl,
      themeColor: updated.themeColor,
      darkMode: updated.darkMode,
      upgradeBannerText: updated.upgradeBannerText,
      docUrl: updated.docUrl,
      contactUrl: updated.contactUrl,
    };
    brand.apply();
    saveFinished.value = true;
    setTimeout(() => (saveFinished.value = false), 2000);
  } catch (err) {
    saveError.value = (await toApiError(err)).message;
  }
}

async function onLogoChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  logoFile.value = file;
  const updated = await dashboardApi.uploadLogo(file);
  form.value = updated;
  const url = updated.logoPath ? `/api/v1/dashboard/branding/logo?v=${Date.now()}` : null;
  logoPreviewUrl.value = url;
  if (brand.config) brand.config.logoUrl = url;
}

</script>

<template>
  <div v-if="form" class="max-w-6xl mx-auto pb-12 space-y-10">
    <!-- Save button -->
    <div class="flex justify-end items-center select-none">
      <button
        data-test="settings-save"
        @click="saveConfig"
        class="h-12 min-w-36 bg-brand-primary hover:opacity-90 text-white text-base font-bold px-6 rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
      >
        <Check :size="20" />
        <span>{{ saveFinished ? t('settings.saved') : t('settings.save') }}</span>
      </button>
    </div>
    <p v-if="saveError" data-test="settings-save-error" class="-mt-4 text-xs font-medium text-red-600 text-right">
      {{ saveError }}
    </p>

    <section class="bg-white border border-brand-outline-variant/70 rounded-3xl p-6 sm:p-10 shadow-sm">
      <div class="flex items-center gap-3 border-b border-slate-100 pb-7">
        <Palette :size="28" class="text-brand-primary" />
        <h2 class="text-2xl font-bold text-stone-800">{{ t('settings.brand') }}</h2>
      </div>
      <div class="mt-10 space-y-10">
        <div class="space-y-2">
          <label class="text-base font-semibold text-stone-600 select-none">{{ t('settings.siteName') }}</label>
          <input v-model="form.siteName" type="text" class="w-full h-16 text-lg text-stone-800 border border-brand-outline-variant/70 rounded-xl px-5 focus:outline-none focus:border-brand-primary bg-white font-sans transition" />
        </div>
        <div class="space-y-2">
          <label class="text-base font-semibold text-stone-600 select-none">{{ t('settings.logo') }}</label>
          <div class="min-h-[8.75rem] flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between p-5 bg-brand-primary/5 border border-brand-primary/15 rounded-2xl">
            <div class="flex min-w-0 items-center gap-5">
              <div class="w-20 h-20 rounded-xl flex items-center justify-center shrink-0 overflow-hidden bg-brand-primary text-white">
                <img v-if="logoPreviewUrl" :src="logoPreviewUrl" :alt="t('settings.logo')" class="w-full h-full object-contain" @error="logoPreviewUrl = null" />
                <FileCode v-else :size="32" />
              </div>
              <div class="min-w-0"><p class="truncate text-lg font-bold text-stone-800">{{ logoName }}</p><p class="mt-1 text-sm text-stone-400">{{ t('settings.logoHint') }}</p></div>
            </div>
            <label class="self-end sm:self-auto text-base font-bold text-brand-primary hover:opacity-80 cursor-pointer bg-white border border-stone-200 px-5 py-2.5 rounded-xl shadow-sm transition">
              {{ t('settings.change') }}
              <input type="file" accept="image/png,image/svg+xml" class="hidden" @change="onLogoChange" />
            </label>
          </div>
        </div>
        <div class="space-y-3">
          <label class="text-base font-semibold text-stone-600 block select-none">{{ t('settings.themeColor') }}</label>
          <div class="flex flex-wrap items-center justify-between gap-5 bg-slate-50 p-4 sm:px-6 border border-slate-100 rounded-xl">
            <div class="flex items-center gap-4">
              <button v-for="tc in themeColors" :key="tc.name" type="button" :aria-label="tc.name" @click="form.themeColor = tc.hex" :class="['w-11 h-11 rounded-full border transition-all cursor-pointer relative flex items-center justify-center', form.themeColor.toUpperCase() === tc.hex.toUpperCase() ? 'ring-4 ring-brand-primary/15' : 'hover:scale-105']" :style="{ backgroundColor: tc.hex, borderColor: 'rgba(0,0,0,0.08)' }">
                <span v-if="form.themeColor.toUpperCase() === tc.hex.toUpperCase()" class="w-3 h-3 bg-white rounded-full shadow-sm" />
              </button>
            </div>
            <div class="flex items-center gap-3 select-none"><span class="w-6 h-6 rounded-md border border-stone-200" :style="{ backgroundColor: form.themeColor }" /><span class="text-lg font-mono font-bold text-stone-800 uppercase">{{ form.themeColor }}</span></div>
          </div>
        </div>
      </div>
    </section>

    <section data-test="settings-version-info" class="bg-white border border-brand-outline-variant/70 rounded-3xl px-6 py-8 sm:px-10 shadow-sm flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
      <div class="flex items-center gap-3"><ShieldCheck :size="28" class="text-brand-primary" /><h2 class="text-2xl font-bold text-stone-800">{{ t('settings.versionTitle') }}</h2></div>
      <div class="flex flex-wrap items-center gap-4 sm:gap-5"><span class="text-base font-semibold text-stone-400">{{ t('settings.currentVersion') }}</span><span class="text-2xl font-bold text-brand-primary">v{{ version?.current ?? '—' }}</span><span class="rounded-md bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-sm font-bold text-emerald-600">{{ t('settings.stable') }}</span></div>
    </section>
  </div>
</template>

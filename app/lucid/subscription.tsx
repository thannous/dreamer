import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  LucidButton,
  LucidCard,
  LucidIconAction,
  LucidPill,
  LucidScreen,
  LucidSectionHeader,
} from '@/components/lucid/LucidUI';
import { getLucidPalette } from '@/constants/lucidTheme';
import { useLucidTrainer } from '@/context/LucidTrainerContext';
import { useTheme } from '@/context/ThemeContext';
import { useSubscription } from '@/hooks/useSubscription';
import { trackProductEvent } from '@/lib/analytics';
import {
  calculateAnnualDiscount,
  calculateMonthlyEquivalent,
  sortPackages,
} from '@/lib/paywallUtils';
import type { PurchasePackage, SubscriptionTier } from '@/lib/types';

const COPY = {
  en: {
    eyebrow: 'Noctalia Plus',
    title: 'One subscription, two companions',
    subtitle:
      'Use the same Noctalia account. Lucid Trainer’s core training stays useful without Plus.',
    active: 'Plus active',
    free: 'Free plan',
    shared: 'Shared entitlement',
    freeBody:
      'MILD, SSILD and WBTB programmes, reality checks, morning reviews and core progress remain available for free.',
    activeBody:
      'Your Plus entitlement is recognised here and in Noctalia when you use the same account.',
    benefitsTitle: 'What Plus adds',
    benefitsCaption: 'Optional extras across the Noctalia ecosystem.',
    benefits: [
      'Expanded trends and comparisons',
      'Noctalia premium interpretation features',
      'One entitlement restored on the same account',
    ],
    plansTitle: 'Choose a plan',
    plansCaption: 'The store confirms the exact price and renewal terms before payment.',
    monthly: 'Monthly',
    annual: 'Annual',
    perMonth: 'per month',
    billedMonthly: 'Billed monthly',
    billedAnnual: 'Billed annually at {price}',
    save: 'Save {discount}%',
    selectPlan: 'Select {plan}',
    selectedPlan: '{plan}, selected',
    purchase: 'Continue with {plan}',
    purchasing: 'Contacting the store…',
    restore: 'Restore purchases',
    restoring: 'Checking purchases…',
    signInTitle: 'Connect your Noctalia account',
    signInBody:
      'Purchases are attached to an account so the entitlement can be recovered safely across both companions.',
    signIn: 'Open account',
    loadingTitle: 'Loading store offers',
    loadingBody: 'This can take a moment. Your free training remains available.',
    errorTitle: 'Store temporarily unavailable',
    errorBody:
      'The store could not load or complete this action. No charge is assumed, and free training remains available.',
    unavailableTitle: 'No offer available',
    unavailableBody:
      'This store or build has no purchase offer right now. You can continue using every essential training feature.',
    checkStatus: 'Check subscription status',
    checkingStatus: 'Checking status…',
    purchaseSuccess: 'Plus is now active on this account.',
    purchasePending:
      'The store returned without a confirmed Plus entitlement. Check the status or restore purchases before trying again.',
    purchaseError: 'The purchase could not be completed. No charge has been confirmed.',
    restoredActive: 'Plus purchases were restored for this account.',
    restoredFree: 'No active Plus purchase was found for this account.',
    restoreError: 'Purchases could not be restored right now.',
    statusActive: 'Plus is active on this account.',
    statusFree: 'This account currently uses the free plan.',
    stateTitle: 'Subscription status',
    stateBody:
      'Purchases use the device store through RevenueCat and then converge with the connected Noctalia account.',
    renewsOn: 'Renews on {date}',
    accessUntil: 'Access until {date}',
    privacy: 'Privacy and data',
    storeNote:
      'Apple or Google handles payment. The final store sheet shows the exact price, billing period and cancellation terms.',
  },
  fr: {
    eyebrow: 'Noctalia Plus',
    title: 'Un abonnement, deux compagnons',
    subtitle:
      'Utilisez le même compte Noctalia. Le cœur de Lucid Trainer reste utile sans Plus.',
    active: 'Plus actif',
    free: 'Formule gratuite',
    shared: 'Droit partagé',
    freeBody:
      'Les programmes MILD, SSILD et WBTB, les tests de réalité, les bilans du matin et la progression essentielle restent gratuits.',
    activeBody:
      'Votre droit Plus est reconnu ici et dans Noctalia lorsque vous utilisez le même compte.',
    benefitsTitle: 'Ce que Plus ajoute',
    benefitsCaption: 'Des compléments facultatifs dans l’écosystème Noctalia.',
    benefits: [
      'Tendances et comparaisons approfondies',
      'Fonctions d’interprétation premium dans Noctalia',
      'Un droit restauré avec le même compte',
    ],
    plansTitle: 'Choisir une formule',
    plansCaption: 'La boutique confirme le prix exact et le renouvellement avant paiement.',
    monthly: 'Mensuelle',
    annual: 'Annuelle',
    perMonth: 'par mois',
    billedMonthly: 'Facturation mensuelle',
    billedAnnual: 'Facturation annuelle à {price}',
    save: 'Économisez {discount} %',
    selectPlan: 'Choisir {plan}',
    selectedPlan: '{plan}, sélectionnée',
    purchase: 'Continuer avec la formule {plan}',
    purchasing: 'Connexion à la boutique…',
    restore: 'Restaurer les achats',
    restoring: 'Vérification des achats…',
    signInTitle: 'Connectez votre compte Noctalia',
    signInBody:
      'Les achats sont liés à un compte afin de restaurer le droit de façon sûre dans les deux compagnons.',
    signIn: 'Ouvrir le compte',
    loadingTitle: 'Chargement des offres',
    loadingBody: 'Cela peut prendre un instant. Votre entraînement gratuit reste disponible.',
    errorTitle: 'Boutique temporairement indisponible',
    errorBody:
      'La boutique n’a pas pu charger ou terminer cette action. Aucun débit n’est supposé et l’entraînement gratuit reste disponible.',
    unavailableTitle: 'Aucune offre disponible',
    unavailableBody:
      'Cette boutique ou cette version ne propose aucun achat pour le moment. Toutes les fonctions essentielles restent utilisables.',
    checkStatus: 'Vérifier l’abonnement',
    checkingStatus: 'Vérification du statut…',
    purchaseSuccess: 'Plus est maintenant actif sur ce compte.',
    purchasePending:
      'La boutique a répondu sans droit Plus confirmé. Vérifiez l’abonnement ou restaurez les achats avant de réessayer.',
    purchaseError: 'L’achat n’a pas pu aboutir. Aucun débit n’est confirmé.',
    restoredActive: 'Les achats Plus ont été restaurés pour ce compte.',
    restoredFree: 'Aucun achat Plus actif n’a été trouvé pour ce compte.',
    restoreError: 'Les achats ne peuvent pas être restaurés pour le moment.',
    statusActive: 'Plus est actif sur ce compte.',
    statusFree: 'Ce compte utilise actuellement la formule gratuite.',
    stateTitle: 'État de l’abonnement',
    stateBody:
      'Les achats passent par la boutique de l’appareil via RevenueCat, puis convergent avec le compte Noctalia connecté.',
    renewsOn: 'Renouvellement le {date}',
    accessUntil: 'Accès jusqu’au {date}',
    privacy: 'Confidentialité et données',
    storeNote:
      'Apple ou Google gère le paiement. La fiche finale de la boutique affiche le prix exact, la période et les modalités de résiliation.',
  },
  es: {
    eyebrow: 'Noctalia Plus',
    title: 'Una suscripción, dos compañeros',
    subtitle:
      'Usa la misma cuenta de Noctalia. El entrenamiento esencial de Lucid Trainer sigue siendo útil sin Plus.',
    active: 'Plus activo',
    free: 'Plan gratuito',
    shared: 'Derecho compartido',
    freeBody:
      'Los programas MILD, SSILD y WBTB, las pruebas de realidad, las revisiones matinales y el progreso esencial siguen siendo gratuitos.',
    activeBody:
      'Tu derecho Plus se reconoce aquí y en Noctalia cuando utilizas la misma cuenta.',
    benefitsTitle: 'Qué añade Plus',
    benefitsCaption: 'Extras opcionales en el ecosistema Noctalia.',
    benefits: [
      'Tendencias y comparaciones ampliadas',
      'Funciones premium de interpretación en Noctalia',
      'Un derecho restaurado con la misma cuenta',
    ],
    plansTitle: 'Elige un plan',
    plansCaption: 'La tienda confirma el precio exacto y la renovación antes del pago.',
    monthly: 'Mensual',
    annual: 'Anual',
    perMonth: 'al mes',
    billedMonthly: 'Facturación mensual',
    billedAnnual: 'Facturación anual de {price}',
    save: 'Ahorra un {discount} %',
    selectPlan: 'Seleccionar {plan}',
    selectedPlan: '{plan}, seleccionado',
    purchase: 'Continuar con el plan {plan}',
    purchasing: 'Conectando con la tienda…',
    restore: 'Restaurar compras',
    restoring: 'Comprobando compras…',
    signInTitle: 'Conecta tu cuenta de Noctalia',
    signInBody:
      'Las compras se vinculan a una cuenta para recuperar el derecho de forma segura en ambos compañeros.',
    signIn: 'Abrir cuenta',
    loadingTitle: 'Cargando ofertas',
    loadingBody: 'Puede tardar un momento. Tu entrenamiento gratuito sigue disponible.',
    errorTitle: 'Tienda temporalmente no disponible',
    errorBody:
      'La tienda no pudo cargar o completar esta acción. No se presupone ningún cobro y el entrenamiento gratuito sigue disponible.',
    unavailableTitle: 'No hay ofertas disponibles',
    unavailableBody:
      'Esta tienda o compilación no ofrece compras ahora. Puedes seguir usando todas las funciones esenciales.',
    checkStatus: 'Comprobar la suscripción',
    checkingStatus: 'Comprobando el estado…',
    purchaseSuccess: 'Plus ya está activo en esta cuenta.',
    purchasePending:
      'La tienda respondió sin confirmar el derecho Plus. Comprueba el estado o restaura las compras antes de intentarlo de nuevo.',
    purchaseError: 'No se pudo completar la compra. No se ha confirmado ningún cobro.',
    restoredActive: 'Las compras Plus se restauraron para esta cuenta.',
    restoredFree: 'No se encontró ninguna compra Plus activa para esta cuenta.',
    restoreError: 'No se pudieron restaurar las compras ahora.',
    statusActive: 'Plus está activo en esta cuenta.',
    statusFree: 'Esta cuenta usa actualmente el plan gratuito.',
    stateTitle: 'Estado de la suscripción',
    stateBody:
      'Las compras usan la tienda del dispositivo mediante RevenueCat y después convergen con la cuenta de Noctalia conectada.',
    renewsOn: 'Se renueva el {date}',
    accessUntil: 'Acceso hasta el {date}',
    privacy: 'Privacidad y datos',
    storeNote:
      'Apple o Google gestiona el pago. La ficha final de la tienda muestra el precio, el periodo y las condiciones de cancelación.',
  },
  de: {
    eyebrow: 'Noctalia Plus',
    title: 'Ein Abo, zwei Begleiter',
    subtitle:
      'Verwende dasselbe Noctalia-Konto. Das Kerntraining von Lucid Trainer bleibt ohne Plus nützlich.',
    active: 'Plus aktiv',
    free: 'Kostenlos',
    shared: 'Gemeinsamer Anspruch',
    freeBody:
      'MILD-, SSILD- und WBTB-Programme, Realitätstests, Morgenrückblicke und der grundlegende Fortschritt bleiben kostenlos.',
    activeBody:
      'Dein Plus-Anspruch wird hier und in Noctalia erkannt, wenn du dasselbe Konto verwendest.',
    benefitsTitle: 'Was Plus ergänzt',
    benefitsCaption: 'Optionale Extras im Noctalia-Ökosystem.',
    benefits: [
      'Erweiterte Trends und Vergleiche',
      'Premium-Deutungsfunktionen in Noctalia',
      'Ein Anspruch, der mit demselben Konto wiederhergestellt wird',
    ],
    plansTitle: 'Abo auswählen',
    plansCaption: 'Der Store bestätigt Preis und Verlängerung vor der Zahlung.',
    monthly: 'Monatlich',
    annual: 'Jährlich',
    perMonth: 'pro Monat',
    billedMonthly: 'Monatliche Abrechnung',
    billedAnnual: 'Jährliche Abrechnung zu {price}',
    save: '{discount} % sparen',
    selectPlan: '{plan} auswählen',
    selectedPlan: '{plan}, ausgewählt',
    purchase: 'Mit {plan} fortfahren',
    purchasing: 'Verbindung zum Store…',
    restore: 'Käufe wiederherstellen',
    restoring: 'Käufe werden geprüft…',
    signInTitle: 'Noctalia-Konto verbinden',
    signInBody:
      'Käufe werden einem Konto zugeordnet, damit der Anspruch in beiden Begleitern sicher wiederhergestellt werden kann.',
    signIn: 'Konto öffnen',
    loadingTitle: 'Store-Angebote werden geladen',
    loadingBody: 'Das kann einen Moment dauern. Dein kostenloses Training bleibt verfügbar.',
    errorTitle: 'Store vorübergehend nicht verfügbar',
    errorBody:
      'Der Store konnte diese Aktion nicht laden oder abschließen. Es wird keine Abbuchung angenommen; das kostenlose Training bleibt verfügbar.',
    unavailableTitle: 'Kein Angebot verfügbar',
    unavailableBody:
      'Dieser Store oder Build bietet derzeit keinen Kauf an. Alle wesentlichen Trainingsfunktionen bleiben nutzbar.',
    checkStatus: 'Abostatus prüfen',
    checkingStatus: 'Status wird geprüft…',
    purchaseSuccess: 'Plus ist jetzt für dieses Konto aktiv.',
    purchasePending:
      'Der Store hat keinen Plus-Anspruch bestätigt. Prüfe den Status oder stelle Käufe wieder her, bevor du es erneut versuchst.',
    purchaseError: 'Der Kauf konnte nicht abgeschlossen werden. Es wurde keine Abbuchung bestätigt.',
    restoredActive: 'Plus-Käufe wurden für dieses Konto wiederhergestellt.',
    restoredFree: 'Für dieses Konto wurde kein aktiver Plus-Kauf gefunden.',
    restoreError: 'Käufe konnten gerade nicht wiederhergestellt werden.',
    statusActive: 'Plus ist für dieses Konto aktiv.',
    statusFree: 'Dieses Konto verwendet derzeit den kostenlosen Tarif.',
    stateTitle: 'Abonnementstatus',
    stateBody:
      'Käufe laufen über den Gerätestore via RevenueCat und werden anschließend mit dem verbundenen Noctalia-Konto abgeglichen.',
    renewsOn: 'Verlängerung am {date}',
    accessUntil: 'Zugang bis {date}',
    privacy: 'Datenschutz und Daten',
    storeNote:
      'Apple oder Google verarbeitet die Zahlung. Das letzte Store-Fenster zeigt Preis, Zeitraum und Kündigungsbedingungen.',
  },
  it: {
    eyebrow: 'Noctalia Plus',
    title: 'Un abbonamento, due compagni',
    subtitle:
      'Usa lo stesso account Noctalia. L’allenamento essenziale di Lucid Trainer resta utile senza Plus.',
    active: 'Plus attivo',
    free: 'Piano gratuito',
    shared: 'Diritto condiviso',
    freeBody:
      'I programmi MILD, SSILD e WBTB, i test di realtà, i bilanci mattutini e i progressi essenziali restano gratuiti.',
    activeBody:
      'Il tuo diritto Plus viene riconosciuto qui e in Noctalia quando usi lo stesso account.',
    benefitsTitle: 'Cosa aggiunge Plus',
    benefitsCaption: 'Extra facoltativi nell’ecosistema Noctalia.',
    benefits: [
      'Tendenze e confronti più approfonditi',
      'Funzioni premium di interpretazione in Noctalia',
      'Un diritto ripristinato con lo stesso account',
    ],
    plansTitle: 'Scegli un piano',
    plansCaption: 'Lo store conferma il prezzo esatto e il rinnovo prima del pagamento.',
    monthly: 'Mensile',
    annual: 'Annuale',
    perMonth: 'al mese',
    billedMonthly: 'Fatturazione mensile',
    billedAnnual: 'Fatturazione annuale di {price}',
    save: 'Risparmia il {discount}%',
    selectPlan: 'Seleziona {plan}',
    selectedPlan: '{plan}, selezionato',
    purchase: 'Continua con il piano {plan}',
    purchasing: 'Connessione allo store…',
    restore: 'Ripristina acquisti',
    restoring: 'Verifica degli acquisti…',
    signInTitle: 'Collega il tuo account Noctalia',
    signInBody:
      'Gli acquisti vengono associati a un account per recuperare il diritto in modo sicuro in entrambi i compagni.',
    signIn: 'Apri account',
    loadingTitle: 'Caricamento delle offerte',
    loadingBody: 'Potrebbe richiedere un momento. L’allenamento gratuito resta disponibile.',
    errorTitle: 'Store temporaneamente non disponibile',
    errorBody:
      'Lo store non ha potuto caricare o completare questa azione. Non si presume alcun addebito e l’allenamento gratuito resta disponibile.',
    unavailableTitle: 'Nessuna offerta disponibile',
    unavailableBody:
      'Questo store o questa build non offre acquisti al momento. Puoi continuare a usare tutte le funzioni essenziali.',
    checkStatus: 'Verifica abbonamento',
    checkingStatus: 'Verifica dello stato…',
    purchaseSuccess: 'Plus è ora attivo su questo account.',
    purchasePending:
      'Lo store non ha confermato il diritto Plus. Verifica lo stato o ripristina gli acquisti prima di riprovare.',
    purchaseError: 'L’acquisto non è stato completato. Nessun addebito è stato confermato.',
    restoredActive: 'Gli acquisti Plus sono stati ripristinati per questo account.',
    restoredFree: 'Non è stato trovato alcun acquisto Plus attivo per questo account.',
    restoreError: 'Non è stato possibile ripristinare gli acquisti ora.',
    statusActive: 'Plus è attivo su questo account.',
    statusFree: 'Questo account usa attualmente il piano gratuito.',
    stateTitle: 'Stato dell’abbonamento',
    stateBody:
      'Gli acquisti usano lo store del dispositivo tramite RevenueCat e poi convergono con l’account Noctalia collegato.',
    renewsOn: 'Rinnovo il {date}',
    accessUntil: 'Accesso fino al {date}',
    privacy: 'Privacy e dati',
    storeNote:
      'Apple o Google gestisce il pagamento. La schermata finale dello store mostra prezzo, periodo e condizioni di annullamento.',
  },
} as const;

type Action = 'purchase' | 'restore' | 'refresh' | null;

type Feedback = {
  tone: 'success' | 'neutral' | 'error';
  message: string;
};

function replaceToken(template: string, token: string, value: string): string {
  return template.replace(`{${token}}`, value);
}

function getTier(status: { tier: SubscriptionTier; isActive: boolean } | null): 'free' | 'plus' | 'unknown' {
  if (!status) return 'unknown';
  return status.tier === 'plus' && status.isActive ? 'plus' : 'free';
}

function isPurchaseCancelled(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { userCancelled?: boolean; code?: string | number };
  return (
    candidate.userCancelled === true ||
    candidate.code === 'PURCHASE_CANCELLED_ERROR' ||
    candidate.code === 'PurchaseCancelledError' ||
    candidate.code === 'USER_CANCELED' ||
    candidate.code === 1 ||
    candidate.code === '1'
  );
}

function formatMonthlyEquivalent(pkg: PurchasePackage, locale: string): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: pkg.currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(calculateMonthlyEquivalent(pkg));
  } catch {
    return pkg.priceFormatted;
  }
}

function formatExpiryDate(value: string, locale: string): string | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(date);
  } catch {
    return null;
  }
}

export default function LucidSubscriptionScreen() {
  const { colors, mode } = useTheme();
  const palette = getLucidPalette(colors, mode);
  const { content, state } = useLucidTrainer();
  const subscription = useSubscription({ loadPackages: true });
  const copy = COPY[content.locale];
  const analyticsEnabled = state?.onboarding.analyticsConsent === true;
  const tier = getTier(subscription.status);
  const sortedPackages = useMemo(
    () => sortPackages(subscription.packages),
    [subscription.packages]
  );
  const annualDiscount = useMemo(
    () => calculateAnnualDiscount(sortedPackages),
    [sortedPackages]
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [action, setAction] = useState<Action>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const viewedAnalyticsRef = useRef(false);

  const selectedPackage = useMemo(
    () =>
      sortedPackages.find((pkg) => pkg.id === selectedId) ??
      sortedPackages.find((pkg) => pkg.interval === 'annual') ??
      sortedPackages[0] ??
      null,
    [selectedId, sortedPackages]
  );

  useEffect(() => {
    if (!analyticsEnabled || subscription.loading || viewedAnalyticsRef.current) return;
    viewedAnalyticsRef.current = true;
    void trackProductEvent('lucid_conversion', {
      surface: 'paywall',
      action: 'viewed',
      tier,
    });
  }, [analyticsEnabled, subscription.loading, tier]);

  const close = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/lucid/(tabs)/settings');
    }
  }, []);

  const openAccount = useCallback(() => {
    router.push('/lucid/account');
  }, []);

  const handlePurchase = useCallback(async () => {
    if (subscription.requiresAuth) {
      openAccount();
      return;
    }
    if (!selectedPackage || subscription.loading || subscription.processing) return;

    setFeedback(null);
    setAction('purchase');
    if (analyticsEnabled) {
      void trackProductEvent('lucid_conversion', {
        surface: 'paywall',
        action: 'started',
        tier,
      });
    }

    try {
      const status = await subscription.purchase(selectedPackage.id);
      const completedTier = getTier(status);
      setFeedback({
        tone: completedTier === 'plus' ? 'success' : 'neutral',
        message: completedTier === 'plus' ? copy.purchaseSuccess : copy.purchasePending,
      });
      if (analyticsEnabled) {
        void trackProductEvent('lucid_conversion', {
          surface: 'paywall',
          action: 'completed',
          tier: completedTier,
        });
      }
    } catch (error) {
      if (!isPurchaseCancelled(error)) {
        setFeedback({ tone: 'error', message: copy.purchaseError });
      }
    } finally {
      setAction(null);
    }
  }, [
    analyticsEnabled,
    copy.purchaseError,
    copy.purchasePending,
    copy.purchaseSuccess,
    openAccount,
    selectedPackage,
    subscription,
    tier,
  ]);

  const handleRestore = useCallback(async () => {
    if (subscription.requiresAuth) {
      openAccount();
      return;
    }
    if (subscription.processing) return;

    setFeedback(null);
    setAction('restore');
    try {
      const status = await subscription.restore();
      const restoredTier = getTier(status);
      setFeedback({
        tone: restoredTier === 'plus' ? 'success' : 'neutral',
        message: restoredTier === 'plus' ? copy.restoredActive : copy.restoredFree,
      });
      if (analyticsEnabled) {
        void trackProductEvent('lucid_conversion', {
          surface: 'paywall',
          action: 'restored',
          tier: restoredTier,
        });
      }
    } catch {
      setFeedback({ tone: 'error', message: copy.restoreError });
    } finally {
      setAction(null);
    }
  }, [analyticsEnabled, copy, openAccount, subscription]);

  const handleRefresh = useCallback(async () => {
    if (subscription.requiresAuth) {
      openAccount();
      return;
    }
    if (subscription.refreshing || subscription.processing) return;

    setFeedback(null);
    setAction('refresh');
    try {
      const status = await subscription.refreshSubscription();
      const refreshedTier = getTier(status);
      setFeedback({
        tone: refreshedTier === 'plus' ? 'success' : 'neutral',
        message: refreshedTier === 'plus' ? copy.statusActive : copy.statusFree,
      });
    } catch {
      setFeedback({ tone: 'error', message: copy.errorBody });
    } finally {
      setAction(null);
    }
  }, [copy, openAccount, subscription]);

  const expiry = subscription.status?.expiryDate
    ? formatExpiryDate(subscription.status.expiryDate, content.locale)
    : null;
  const expiryLabel = expiry
    ? replaceToken(
        subscription.status?.willRenew ? copy.renewsOn : copy.accessUntil,
        'date',
        expiry
      )
    : null;
  const purchaseLabel = selectedPackage
    ? replaceToken(
        copy.purchase,
        'plan',
        selectedPackage.interval === 'annual' ? copy.annual : copy.monthly
      )
    : copy.unavailableTitle;
  const busy = subscription.processing || action !== null;

  return (
    <LucidScreen
      eyebrow={copy.eyebrow}
      title={copy.title}
      subtitle={copy.subtitle}
      trailing={
        <LucidIconAction label={content.chrome.common.back} icon="close" onPress={close} />
      }
      testID="lucid-subscription-screen"
    >
      <LucidCard accent={subscription.isActive ? 'accent' : 'none'}>
        <View style={styles.hero}>
          <View
            style={[
              styles.heroIcon,
              {
                backgroundColor: subscription.isActive
                  ? palette.accentSoft
                  : palette.accentSoft,
              },
            ]}
          >
            <Ionicons
              name="diamond"
              size={34}
              color={subscription.isActive ? palette.accent : palette.accent}
            />
          </View>
          <View style={styles.heroCopy}>
            <View style={styles.pills}>
              <LucidPill
                label={subscription.isActive ? copy.active : copy.free}
                tone={subscription.isActive ? 'accent' : 'neutral'}
              />
              <LucidPill label={copy.shared} tone="accent" icon="link" />
            </View>
            <Text style={[styles.heroBody, { color: palette.text }]}>
              {subscription.isActive ? copy.activeBody : copy.freeBody}
            </Text>
          </View>
        </View>
      </LucidCard>

      <LucidCard>
        <LucidSectionHeader title={copy.benefitsTitle} caption={copy.benefitsCaption} />
        <View style={styles.features}>
          {copy.benefits.map((feature) => (
            <View key={feature} style={styles.featureRow}>
              <Ionicons name="checkmark-circle" size={20} color={palette.accent} />
              <Text style={[styles.featureText, { color: palette.textSecondary }]}>
                {feature}
              </Text>
            </View>
          ))}
        </View>
      </LucidCard>

      {subscription.requiresAuth ? (
        <LucidCard accent="amber">
          <View style={styles.stateRow}>
            <Ionicons name="person-circle" size={26} color={palette.amber} />
            <View style={styles.stateCopy}>
              <Text accessibilityRole="header" style={[styles.cardTitle, { color: palette.text }]}>
                {copy.signInTitle}
              </Text>
              <Text style={[styles.cardBody, { color: palette.textSecondary }]}>
                {copy.signInBody}
              </Text>
            </View>
          </View>
          <LucidButton
            label={copy.signIn}
            icon="person"
            onPress={openAccount}
            testID="lucid-open-account"
          />
        </LucidCard>
      ) : null}

      {subscription.loading ? (
        <LucidCard>
          <View
            accessibilityLiveRegion="polite"
            accessibilityRole="progressbar"
            style={styles.loadingRow}
          >
            <ActivityIndicator
              accessibilityLabel={copy.loadingTitle}
              color={palette.accent}
              size="small"
            />
            <View style={styles.stateCopy}>
              <Text style={[styles.cardTitle, { color: palette.text }]}>{copy.loadingTitle}</Text>
              <Text style={[styles.cardBody, { color: palette.textSecondary }]}>
                {copy.loadingBody}
              </Text>
            </View>
          </View>
        </LucidCard>
      ) : null}

      {subscription.error ? (
        <LucidCard accent="amber">
          <View accessibilityLiveRegion="assertive" accessibilityRole="alert" style={styles.stateRow}>
            <Ionicons name="cloud-offline" size={25} color={palette.amber} />
            <View style={styles.stateCopy}>
              <Text style={[styles.cardTitle, { color: palette.text }]}>{copy.errorTitle}</Text>
              <Text style={[styles.cardBody, { color: palette.textSecondary }]}>
                {copy.errorBody}
              </Text>
            </View>
          </View>
          {!subscription.requiresAuth ? (
            <LucidButton
              label={action === 'refresh' ? copy.checkingStatus : copy.checkStatus}
              icon="refresh"
              variant="secondary"
              loading={action === 'refresh' || subscription.refreshing}
              onPress={() => void handleRefresh()}
              testID="lucid-check-subscription"
            />
          ) : null}
        </LucidCard>
      ) : null}

      {!subscription.loading && !subscription.isActive && sortedPackages.length > 0 ? (
        <View style={styles.section}>
          <LucidSectionHeader title={copy.plansTitle} caption={copy.plansCaption} />
          <View accessibilityRole="radiogroup" style={styles.planList}>
            {sortedPackages.map((pkg) => {
              const selected = selectedPackage?.id === pkg.id;
              const planName = pkg.interval === 'annual' ? copy.annual : copy.monthly;
              const price =
                pkg.interval === 'annual'
                  ? formatMonthlyEquivalent(pkg, content.locale)
                  : pkg.priceFormatted;
              const billing =
                pkg.interval === 'annual'
                  ? replaceToken(copy.billedAnnual, 'price', pkg.priceFormatted)
                  : copy.billedMonthly;
              const accessibilityLabel = replaceToken(
                selected ? copy.selectedPlan : copy.selectPlan,
                'plan',
                planName
              );

              return (
                <Pressable
                  accessibilityLabel={`${accessibilityLabel}. ${price} ${copy.perMonth}. ${billing}`}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected, disabled: busy }}
                  disabled={busy}
                  key={pkg.id}
                  onPress={() => setSelectedId(pkg.id)}
                  testID={`lucid-plan-${pkg.interval}`}
                  style={({ pressed }) => [
                    styles.plan,
                    {
                      backgroundColor: selected ? palette.accentSoft : palette.surface,
                      borderColor: selected ? palette.accent : palette.borderInteractive,
                      opacity: busy ? 0.55 : pressed ? 0.78 : 1,
                    },
                  ]}
                >
                  <View style={styles.planCopy}>
                    <View style={styles.planHeading}>
                      <Text style={[styles.planName, { color: palette.text }]}>{planName}</Text>
                      {pkg.interval === 'annual' && annualDiscount ? (
                        <LucidPill
                          label={replaceToken(copy.save, 'discount', String(annualDiscount))}
                          tone="accent"
                        />
                      ) : null}
                    </View>
                    <View style={styles.priceRow}>
                      <Text style={[styles.price, { color: palette.text }]}>{price}</Text>
                      <Text style={[styles.period, { color: palette.textSecondary }]}>
                        {copy.perMonth}
                      </Text>
                    </View>
                    <Text style={[styles.billing, { color: palette.textMuted }]}>{billing}</Text>
                  </View>
                  <Ionicons
                    name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                    size={25}
                    color={selected ? palette.accent : palette.textMuted}
                  />
                </Pressable>
              );
            })}
          </View>
          {subscription.requiresAuth ? (
            <LucidButton
              label={copy.signIn}
              icon="person"
              onPress={openAccount}
              testID="lucid-purchase"
            />
          ) : (
            <LucidButton
              label={action === 'purchase' ? copy.purchasing : purchaseLabel}
              icon="sparkles"
              disabled={!selectedPackage || busy}
              loading={action === 'purchase'}
              onPress={() => void handlePurchase()}
              testID="lucid-purchase"
            />
          )}
        </View>
      ) : null}

      {!subscription.loading && !subscription.isActive && sortedPackages.length === 0 ? (
        <LucidCard>
          <View style={styles.stateRow}>
            <Ionicons name="bag-handle" size={25} color={palette.textMuted} />
            <View style={styles.stateCopy}>
              <Text accessibilityRole="header" style={[styles.cardTitle, { color: palette.text }]}>
                {copy.unavailableTitle}
              </Text>
              <Text style={[styles.cardBody, { color: palette.textSecondary }]}>
                {copy.unavailableBody}
              </Text>
            </View>
          </View>
        </LucidCard>
      ) : null}

      {feedback ? (
        <View
          accessibilityLiveRegion={feedback.tone === 'error' ? 'assertive' : 'polite'}
          accessibilityRole={feedback.tone === 'error' ? 'alert' : 'summary'}
          style={[
            styles.feedback,
            {
              backgroundColor:
                feedback.tone === 'success'
                  ? `${palette.success}18`
                  : feedback.tone === 'error'
                    ? `${palette.danger}18`
                    : palette.surfaceRaised,
              borderColor:
                feedback.tone === 'success'
                  ? `${palette.success}66`
                  : feedback.tone === 'error'
                    ? `${palette.danger}66`
                    : palette.border,
            },
          ]}
          testID="lucid-subscription-feedback"
        >
          <Ionicons
            name={
              feedback.tone === 'success'
                ? 'checkmark-circle'
                : feedback.tone === 'error'
                  ? 'alert-circle'
                  : 'information-circle'
            }
            size={21}
            color={
              feedback.tone === 'success'
                ? palette.success
                : feedback.tone === 'error'
                  ? palette.danger
                  : palette.textSecondary
            }
          />
          <Text style={[styles.feedbackText, { color: palette.text }]}>{feedback.message}</Text>
        </View>
      ) : null}

      <LucidCard>
        <View style={styles.stateRow}>
          <Ionicons
            name={subscription.isActive ? 'shield-checkmark' : 'shield-outline'}
            size={25}
            color={subscription.isActive ? palette.accent : palette.accent}
          />
          <View style={styles.stateCopy}>
            <Text accessibilityRole="header" style={[styles.cardTitle, { color: palette.text }]}>
              {copy.stateTitle}
            </Text>
            <Text style={[styles.cardBody, { color: palette.textSecondary }]}>
              {copy.stateBody}
            </Text>
            {expiryLabel ? <LucidPill label={expiryLabel} tone="neutral" icon="calendar" /> : null}
          </View>
        </View>
        <LucidButton
          label={action === 'restore' ? copy.restoring : copy.restore}
          icon="refresh"
          variant="secondary"
          disabled={busy && action !== 'restore'}
          loading={action === 'restore'}
          onPress={() => void handleRestore()}
          testID="lucid-restore"
        />
        <LucidButton
          label={copy.privacy}
          icon="lock-closed"
          variant="ghost"
          onPress={() => router.push('/lucid/privacy')}
          testID="lucid-subscription-privacy"
        />
        <Text style={[styles.storeNote, { color: palette.textMuted }]}>{copy.storeNote}</Text>
      </LucidCard>
    </LucidScreen>
  );
}

const styles = StyleSheet.create({
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  heroIcon: {
    width: 66,
    height: 66,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCopy: {
    flex: 1,
    gap: 10,
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  heroBody: {
    fontFamily: 'Fraunces_500Medium',
    fontSize: 17,
    lineHeight: 24,
  },
  features: {
    gap: 11,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  featureText: {
    flex: 1,
    fontFamily: 'SpaceGrotesk_500Medium',
    fontSize: 14,
    lineHeight: 20,
  },
  stateRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  stateCopy: {
    flex: 1,
    gap: 6,
  },
  cardTitle: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 16,
    lineHeight: 21,
  },
  cardBody: {
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: 13,
    lineHeight: 19,
  },
  loadingRow: {
    minHeight: 66,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  section: {
    gap: 13,
  },
  planList: {
    gap: 11,
  },
  plan: {
    minHeight: 104,
    borderRadius: 20,
    borderWidth: 1,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  planCopy: {
    flex: 1,
    gap: 5,
  },
  planHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  planName: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 16,
    lineHeight: 21,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: 6,
  },
  price: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 22,
    lineHeight: 28,
    fontVariant: ['tabular-nums'],
  },
  period: {
    fontFamily: 'SpaceGrotesk_500Medium',
    fontSize: 12,
  },
  billing: {
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: 12,
    lineHeight: 17,
  },
  feedback: {
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  feedbackText: {
    flex: 1,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    fontSize: 13,
    lineHeight: 18,
  },
  storeNote: {
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
  },
});

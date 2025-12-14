# Guide de Complétion : Language Dropdown pour les Pages Docs

## Statut actuel

✅ **Complété :**
- Ressources partagées (JS + CSS)
- 3 landing pages principales
- 3 blog index pages
- Références CSS/JS sur les 63 articles de blog
- Références CSS/JS sur les 12 pages légales

⏳ **À compléter :**
- Remplacement du HTML du dropdown dans les 63 articles de blog
- Remplacement du HTML du dropdown dans les 12 pages légales

---

## Étape 3 : Remplacer le HTML dans les Articles de Blog (63 fichiers)

### Pattern à remplacer

Chaque article de blog contient actuellement un sélecteur de langue avec 2 boutons :

```html
<div class="flex items-center gap-3">
    <a href="../../fr/blog/FRENCH_ARTICLE.html" hreflang="fr" ...>
        <i data-lucide="languages" class="w-4 h-4"></i> FR
    </a>
    <a href="../../es/blog/SPANISH_ARTICLE.html" hreflang="es" ...>
        <i data-lucide="languages" class="w-4 h-4"></i> ES
    </a>
</div>
```

### Solution d'automatisation

Utilisez ce script Perl pour remplacer automatiquement tous les articles :

```bash
#!/usr/bin/perl
use strict;
use warnings;
use File::Find;

my $base_dir = '/home/tchau@france.groupe.intra/WebstormProjects/dreamer/docs';

my %lang_data = (
    'en' => { code => 'EN', name => 'English' },
    'fr' => { code => 'FR', name => 'Français' },
    'es' => { code => 'ES', name => 'Español' }
);

foreach my $lang (sort keys %lang_data) {
    my $blog_dir = "$base_dir/$lang/blog";
    my $code = $lang_data{$lang}{code};

    opendir my $dh, $blog_dir or die "Can't open $blog_dir";
    my @articles = grep { /\.html$/ && !/index\.html$/ } readdir $dh;
    closedir $dh;

    print "Processing $lang: " . scalar(@articles) . " articles\n";

    foreach my $article (sort @articles) {
        my $file = "$blog_dir/$article";

        open my $fh, '<:encoding(UTF-8)', $file or die "Can't read $file";
        my $content = do { local $/; <$fh> };
        close $fh;

        # Skip if already updated
        next if $content =~ /language-dropdown-wrapper/;

        # Extract links to other languages
        my %links = ('en' => '', 'fr' => '', 'es' => '');
        $links{$lang} = $article;

        if ($content =~ m|href="\.\.\/\.\.\/en/blog/([^"]+)"|) { $links{en} = $1; }
        if ($content =~ m|href="\.\.\/\.\.\/fr/blog/([^"]+)"|) { $links{fr} = $1; }
        if ($content =~ m|href="\.\.\/\.\.\/es/blog/([^"]+)"|) { $links{es} = $1; }

        # Build replacement dropdown
        my $dropdown = build_dropdown($lang, $code, \%links);

        # Simple pattern: find gap-3 div with language links
        my $pattern = qr|<div\s+class="flex\s+items-center\s+gap-3">\s*<a\s+href="\.\.\/\.\.\/[a-z]{2}/blog/[^"]*"[^>]*>\s*<i[^>]*></i>[^<]*</a>(\s*<a\s+href="\.\.\/\.\.\/[a-z]{2}/blog/[^"]*"[^>]*>\s*<i[^>]*></i>[^<]*</a>)+\s*</div>|s;

        if ($content =~ s/$pattern/$dropdown/) {
            open $fh, '>:encoding(UTF-8)', $file or die "Can't write $file";
            print $fh $content;
            close $fh;

            print "  ✓ $article\n";
        }
    }
}

sub build_dropdown {
    my ($lang, $code, $links_ref) = @_;
    my %links = %$links_ref;
    my @order = ('en', 'fr', 'es');
    my %names = ('en' => 'English', 'fr' => 'Français', 'es' => 'Español');

    my $html = '<div class="flex items-center gap-3">';
    $html .= "\n                <!-- Language Dropdown -->";
    $html .= "\n                <div class=\"language-dropdown-wrapper relative\" id=\"languageDropdown\">";
    $html .= "\n                    <button type=\"button\"";
    $html .= "\n                            class=\"glass-button px-3 py-2 rounded-full text-sm text-purple-100/80 border border-white/10 hover:border-dream-salmon hover:text-white transition-colors flex items-center gap-2\"";
    $html .= "\n                            aria-haspopup=\"true\"";
    $html .= "\n                            aria-expanded=\"false\"";
    $html .= "\n                            aria-label=\"Choose language\"";
    $html .= "\n                            id=\"languageDropdownButton\">";
    $html .= "\n                        <i data-lucide=\"languages\" class=\"w-4 h-4\"></i>";
    $html .= "\n                        <span class=\"hidden sm:inline\">$code</span>";
    $html .= "\n                        <i data-lucide=\"chevron-down\" class=\"w-3 h-3 transition-transform\" id=\"dropdownChevron\"></i>";
    $html .= "\n                    </button>";

    $html .= "\n\n                    <div class=\"language-dropdown-menu absolute right-0 top-full mt-2 glass-panel rounded-2xl py-2 min-w-[160px] hidden z-50\"";
    $html .= "\n                         role=\"menu\"";
    $html .= "\n                         aria-labelledby=\"languageDropdownButton\"";
    $html .= "\n                         id=\"languageDropdownMenu\">";

    foreach my $l (@order) {
        my $href = $links{$l} ? "../$links{$l}" : "#";
        my $check_hidden = ($l eq $lang) ? '' : ' hidden';

        $html .= "\n                        <a href=\"$href\"";
        $html .= "\n                           hreflang=\"$l\"";
        $html .= "\n                           class=\"dropdown-item flex items-center justify-between px-4 py-2 text-sm text-purple-100/80 hover:bg-white/10 hover:text-white transition-colors\"";
        $html .= "\n                           role=\"menuitem\">";
        $html .= "\n                            <span>$names{$l}</span>";
        $html .= "\n                            <i data-lucide=\"check\" class=\"w-4 h-4 text-dream-salmon$check_hidden\"></i>";
        $html .= "\n                        </a>";
    }

    $html .= "\n                    </div>";
    $html .= "\n                </div>";
    $html .= "\n            </div>";

    return $html;
}
```

### Exécution

1. Sauvegardez le script dans un fichier (ex: `/tmp/update_blog_articles.pl`)
2. Rendez-le exécutable : `chmod +x /tmp/update_blog_articles.pl`
3. Exécutez-le : `perl /tmp/update_blog_articles.pl`

---

## Étape 4 : Remplacer le HTML dans les Pages Légales (12 fichiers)

### Pages à mettre à jour

**English :**
- `/docs/en/privacy-policy.html`
- `/docs/en/legal-notice.html`
- `/docs/en/terms.html`
- `/docs/en/account-deletion.html`

**French :**
- `/docs/fr/politique-confidentialite.html`
- `/docs/fr/mentions-legales.html`
- `/docs/fr/cgu.html`
- `/docs/fr/suppression-compte.html`

**Spanish :**
- `/docs/es/politica-privacidad.html`
- `/docs/es/aviso-legal.html`
- `/docs/es/terminos.html`
- `/docs/es/eliminacion-cuenta.html`

### Pattern pour les pages légales

Les pages légales utilisent un pattern similaire aux landing pages (avec les 3 langues visibles), mais les chemins sont différents.

**Exemple pour `/docs/en/privacy-policy.html` :**

```html
<!-- Ancien -->
<div class="flex items-center gap-3">
    <a href="../fr/politique-confidentialite.html" hreflang="fr" ...> FR </a>
    <a href="../es/politica-privacidad.html" hreflang="es" ...> ES </a>
</div>

<!-- Nouveau -->
<div class="flex items-center gap-3">
    <!-- Language Dropdown -->
    <div class="language-dropdown-wrapper relative" id="languageDropdown">
        <button type="button"
                class="glass-button px-3 py-2 rounded-full text-sm text-purple-100/80 border border-white/10 hover:border-dream-salmon hover:text-white transition-colors flex items-center gap-2"
                aria-haspopup="true" aria-expanded="false" aria-label="Choose language"
                id="languageDropdownButton">
            <i data-lucide="languages" class="w-4 h-4"></i>
            <span class="hidden sm:inline">EN</span>
            <i data-lucide="chevron-down" class="w-3 h-3 transition-transform" id="dropdownChevron"></i>
        </button>
        <div class="language-dropdown-menu absolute right-0 top-full mt-2 glass-panel rounded-2xl py-2 min-w-[160px] hidden z-50"
             role="menu" aria-labelledby="languageDropdownButton" id="languageDropdownMenu">
            <a href="../en/privacy-policy.html" hreflang="en" class="dropdown-item flex items-center justify-between px-4 py-2 text-sm text-purple-100/80 hover:bg-white/10 hover:text-white transition-colors" role="menuitem">
                <span>English</span>
                <i data-lucide="check" class="w-4 h-4 text-dream-salmon"></i>
            </a>
            <a href="../fr/politique-confidentialite.html" hreflang="fr" class="dropdown-item flex items-center justify-between px-4 py-2 text-sm text-purple-100/80 hover:bg-white/10 hover:text-white transition-colors" role="menuitem">
                <span>Français</span>
                <i data-lucide="check" class="w-4 h-4 text-dream-salmon hidden"></i>
            </a>
            <a href="../es/politica-privacidad.html" hreflang="es" class="dropdown-item flex items-center justify-between px-4 py-2 text-sm text-purple-100/80 hover:bg-white/10 hover:text-white transition-colors" role="menuitem">
                <span>Español</span>
                <i data-lucide="check" class="w-4 h-4 text-dream-salmon hidden"></i>
            </a>
        </div>
    </div>
</div>
```

### Script d'automatisation pour les pages légales

```bash
#!/usr/bin/perl
use strict;
use warnings;

my $base_dir = '/home/tchau@france.groupe.intra/WebstormProjects/dreamer/docs';

# Mapping des pages légales par langue
my %legal_pages = (
    'en' => {
        'privacy-policy.html' => { fr => 'politique-confidentialite.html', es => 'politica-privacidad.html' },
        'legal-notice.html' => { fr => 'mentions-legales.html', es => 'aviso-legal.html' },
        'terms.html' => { fr => 'cgu.html', es => 'terminos.html' },
        'account-deletion.html' => { fr => 'suppression-compte.html', es => 'eliminacion-cuenta.html' }
    },
    'fr' => {
        'politique-confidentialite.html' => { en => 'privacy-policy.html', es => 'politica-privacidad.html' },
        'mentions-legales.html' => { en => 'legal-notice.html', es => 'aviso-legal.html' },
        'cgu.html' => { en => 'terms.html', es => 'terminos.html' },
        'suppression-compte.html' => { en => 'account-deletion.html', es => 'eliminacion-cuenta.html' }
    },
    'es' => {
        'politica-privacidad.html' => { en => 'privacy-policy.html', fr => 'politique-confidentialite.html' },
        'aviso-legal.html' => { en => 'legal-notice.html', fr => 'mentions-legales.html' },
        'terminos.html' => { en => 'terms.html', fr => 'cgu.html' },
        'eliminacion-cuenta.html' => { en => 'account-deletion.html', fr => 'suppression-compte.html' }
    }
);

my %lang_data = (
    'en' => { code => 'EN', name => 'English' },
    'fr' => { code => 'FR', name => 'Français' },
    'es' => { code => 'ES', name => 'Español' }
);

foreach my $lang (sort keys %legal_pages) {
    my $code = $lang_data{$lang}{code};

    foreach my $page (sort keys %{ $legal_pages{$lang} }) {
        my $file = "$base_dir/$lang/$page";

        next unless -f $file;

        open my $fh, '<:encoding(UTF-8)', $file or die "Can't read $file";
        my $content = do { local $/; <$fh> };
        close $fh;

        # Skip if already updated
        next if $content =~ /language-dropdown-wrapper/;

        my %other_langs = %{ $legal_pages{$lang}{$page} };

        # Build dropdown
        my $dropdown = build_legal_dropdown($lang, $code, $page, \%other_langs);

        # Replace pattern
        if ($content =~ s|<div class="flex items-center gap-3">\s*<a href="\.\./[a-z]{2}/[^"]*" hreflang="[a-z]{2}"[^>]*>\s*<i[^>]*></i>\s*[A-Z]{2}\s*</a>(\s*<a href="\.\./[a-z]{2}/[^"]*" hreflang="[a-z]{2}"[^>]*>\s*<i[^>]*></i>\s*[A-Z]{2}\s*</a>)*\s*</div>|$dropdown|s) {
            open $fh, '>:encoding(UTF-8)', $file or die "Can't write $file";
            print $fh $content;
            close $fh;

            print "✓ $lang/$page\n";
        } else {
            print "- $lang/$page (pattern not matched)\n";
        }
    }
}

sub build_legal_dropdown {
    my ($lang, $code, $page, $other_langs_ref) = @_;
    my %other_langs = %$other_langs_ref;
    my %names = ('en' => 'English', 'fr' => 'Français', 'es' => 'Español');

    my $html = '<div class="flex items-center gap-3">';
    $html .= "\n                <!-- Language Dropdown -->";
    $html .= "\n                <div class=\"language-dropdown-wrapper relative\" id=\"languageDropdown\">";
    $html .= "\n                    <button type=\"button\"";
    $html .= "\n                            class=\"glass-button px-3 py-2 rounded-full text-sm text-purple-100/80 border border-white/10 hover:border-dream-salmon hover:text-white transition-colors flex items-center gap-2\"";
    $html .= "\n                            aria-haspopup=\"true\"";
    $html .= "\n                            aria-expanded=\"false\"";
    $html .= "\n                            aria-label=\"Choose language\"";
    $html .= "\n                            id=\"languageDropdownButton\">";
    $html .= "\n                        <i data-lucide=\"languages\" class=\"w-4 h-4\"></i>";
    $html .= "\n                        <span class=\"hidden sm:inline\">$code</span>";
    $html .= "\n                        <i data-lucide=\"chevron-down\" class=\"w-3 h-3 transition-transform\" id=\"dropdownChevron\"></i>";
    $html .= "\n                    </button>";

    $html .= "\n\n                    <div class=\"language-dropdown-menu absolute right-0 top-full mt-2 glass-panel rounded-2xl py-2 min-w-[160px] hidden z-50\"";
    $html .= "\n                         role=\"menu\"";
    $html .= "\n                         aria-labelledby=\"languageDropdownButton\"";
    $html .= "\n                         id=\"languageDropdownMenu\">";

    # Add current language
    $html .= "\n                        <a href=\"../$lang/$page\"";
    $html .= "\n                           hreflang=\"$lang\"";
    $html .= "\n                           class=\"dropdown-item flex items-center justify-between px-4 py-2 text-sm text-purple-100/80 hover:bg-white/10 hover:text-white transition-colors\"";
    $html .= "\n                           role=\"menuitem\">";
    $html .= "\n                            <span>$names{$lang}</span>";
    $html .= "\n                            <i data-lucide=\"check\" class=\"w-4 h-4 text-dream-salmon\"></i>";
    $html .= "\n                        </a>";

    # Add other languages
    foreach my $l (sort keys %other_langs) {
        my $other_page = $other_langs{$l};
        $html .= "\n                        <a href=\"../$l/$other_page\"";
        $html .= "\n                           hreflang=\"$l\"";
        $html .= "\n                           class=\"dropdown-item flex items-center justify-between px-4 py-2 text-sm text-purple-100/80 hover:bg-white/10 hover:text-white transition-colors\"";
        $html .= "\n                           role=\"menuitem\">";
        $html .= "\n                            <span>$names{$l}</span>";
        $html .= "\n                            <i data-lucide=\"check\" class=\"w-4 h-4 text-dream-salmon hidden\"></i>";
        $html .= "\n                        </a>";
    }

    $html .= "\n                    </div>";
    $html .= "\n                </div>";
    $html .= "\n            </div>";

    return $html;
}
```

---

## Approche Alternative : Mise à Jour Manuelle

Si vous préférez mettre à jour les fichiers individuellement plutôt que d'utiliser un script :

### Pour chaque article/page :

1. Ouvrez le fichier HTML dans un éditeur de texte
2. Localisez la section avec les boutons de langue (cherchez `class="flex items-center gap-3"`)
3. Remplacez le contenu entre `<div class="flex items-center gap-3">` et `</div>`
4. Utilisez le pattern du dropdown présenté ci-dessus
5. Assurez-vous que :
   - Le code de langue actuel (EN, FR, ES) s'affiche dans le bouton
   - Les chemins vers les autres langues sont corrects
   - Le checkmark est visible sur la langue actuelle et caché sur les autres

---

## Validation après Complétion

Une fois tous les fichiers mis à jour :

### 1. Vérifier la syntaxe HTML
```bash
# Vérifier qu'il n'y a pas d'erreurs HTML majeures
grep -r "language-dropdown-wrapper" docs/*/blog/*.html | wc -l
# Devrait retourner 63

grep -r "language-dropdown-wrapper" docs/{en,fr,es}/{privacy-policy,legal-notice,terms,account-deletion,politique-confidentialite,mentions-legales,cgu,suppression-compte,politica-privacidad,aviso-legal,terminos,eliminacion-cuenta}.html | wc -l
# Devrait retourner 12
```

### 2. Tester sur le navigateur

- Ouvrir plusieurs pages dans le navigateur
- Vérifier que le dropdown s'affiche et fonctionne correctement
- Vérifier que les liens pointent vers les bonnes pages
- Tester sur mobile (viewport 375px) pour vérifier la version responsive
- Tester la navigation clavier (Tab, ESC)

### 3. Vérifier les icônes

- Les icônes Lucide (languages, chevron-down, check) doivent s'afficher correctement
- Tester dans différents navigateurs (Chrome, Firefox, Safari, Edge)

---

## Notes Importantes

1. **Encoding** : Tous les fichiers HTML utilisent UTF-8. Assurez-vous que votre script préserve cet encoding.

2. **Indentation** : Les fichiers HTML utilisent 4 espaces pour l'indentation. Essayez de préserver ce style.

3. **Patterns de chemins** :
   - Landing pages : `../en/index.html`, `../fr/index.html`, `../es/index.html`
   - Blog index : `../../en/blog/`, `../../fr/blog/`, `../../es/blog/`
   - Articles blog : `../article-name.html` (même dossier, changement d'URL dans le dropdown)
   - Pages légales : `../en/privacy-policy.html`, `../fr/politique-confidentialite.html`, etc.

4. **Sécurité** : Utilisez l'encoding UTF-8 pour éviter les problèmes avec les caractères spéciaux (accents, etc.)

---

## Support et Dépannage

Si le script Perl ne fonctionne pas :

1. Vérifiez que Perl est installé : `perl --version`
2. Vérifiez les permissions des fichiers
3. Testez d'abord sur un seul fichier en créant une copie de sauvegarde
4. Vérifiez les chemins de répertoire dans le script


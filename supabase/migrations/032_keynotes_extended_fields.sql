alter table keynotes
add column if not exists theme text,
add column if not exists audience text,
add column if not exists language text,
add column if not exists subtitle text,
add column if not exists moderation text,
add column if not exists keynote_long text,
add column if not exists keynote_short text,
add column if not exists speaker text;

insert into
	keynotes (
		id,
		keynote_title,
		keynote_summary,
		image_url,
		image_alt,
		theme,
		audience,
		language,
		subtitle,
		moderation,
		keynote_long,
		keynote_short,
		speaker
	)
values
	(
		'wenn-der-betonmischer-tesla-faehrt-kuenstliche-intelligenz-und-die-naechste-bauw',
		'Wenn der Betonmischer Tesla faehrt',
		'Auftragsflaute, Fachkraeftemangel und Buerokratie halten die Bauwirtschaft in Atem. Kann Kuenstliche Intelligenz das alles auf einmal loesen? Natuerlich nicht! Unternehmer loesen ihre Probleme schon selber. Aber Christoph Holz zeigt drei Hebel, die heute schon Stueckkosten, Kapitalbindung und Stehzeiten druecken - und fuenf Gedankenexperimente fuers Uebermorgen, die das Publikum selbst auswaehlt. Konkret, interaktiv, ueberraschend. Wer versteht wie, gewinnt.',
		'https://images.unsplash.com/photo-1552664730-d307ca884978',
		'Christoph Holz speaking on stage',
		'Kuenstliche Intelligenz / Bauwirtschaft',
		'Geschaeftsfuehrer, Vorstaende und Fuehrungskraefte aus Bauunternehmen, Baustoff- und Baumaschinenherstellern, Generalunternehmern und Bautraegern; Architekten und Planungsbueros; Verbaende und Fachmedien der Bauwirtschaft. Geeignet fuer Strategie-Tagungen, Partner-Events, Jahreskonferenzen und Fachkongresse ab ca. 50 Personen.',
		'Deutsch',
		'Kuenstliche Intelligenz und die naechste Bauwirtschaft',
		$moderation$Klar: Kuenstliche Intelligenz hat Auswirkungen. Aber welche eigentlich - ausgerechnet in einer Branche, die seit Jahrhunderten Stein auf Stein setzt? Prognosen scheitern an der Komplexitaet der Wirklichkeit. Gedankenexperimente sind anders. Sie spielen mit dem Moeglichen. Was waere, wenn der Bagger sich selbst steuert? Wenn die KI in Minuten plant, wofuer ein Architekturbuero Wochen braucht? Wenn die Plattform den Generalunternehmer abloest? Mit Christoph Holz - dem Informatiker, Raumfahrttechniker und Business Angel - schauen wir auf die Bauwirtschaft von morgen. Nicht aengstlich, sondern gestaltend. Viel Spass!$moderation$,
		$keynote_long$<p>Auftragsflaute, Fachkraeftemangel, laehmende Buerokratie - und im Hintergrund teure Kredite und steigende Materialkosten. Die Bauwirtschaft kaempft 2026 an mehreren Fronten gleichzeitig. Jede einzelne Belastung waere zu schaffen. Zusammen ergeben sie eine Kettenreaktion, die selbst gesunde Unternehmen ins Wanken bringt.</p><p><strong>Die provokante Frage:</strong> Kann Kuenstliche Intelligenz das wirklich alles auf einmal loesen - oder ist das nur das naechste Tech-Versprechen, das in der Branche verpufft?</p><p>Christoph Holz liefert die Antwort in zwei Teilen: heute schon funktionierende Hebel - und morgen denkbare Spielzuege. Beides interaktiv, beides mit dem Publikum.</p><h3>Teil 1 - Drei Hebel, die heute schon ziehen</h3><p><strong>1. Auftragsflaute &amp; schwache Nachfrage.</strong> KI senkt die Stueckkosten am Bau - Projekte werden fuer Bauherren wieder kalkulierbar, die Nachfrage kommt zurueck. Generative Planung liefert in Minuten hunderte bauphysikalisch gepruefte Grundriss-Varianten. Modulare Vorfertigung mit KI-Optimierung verkuerzt Bauzeiten um bis zu 30 % und senkt Kosten um 15-20 %. Bid-Intelligence filtert aus oeffentlichen Ausschreibungen die profitablen Projekte heraus - gleiche Vertriebsmannschaft, doppelte Pipeline-Qualitaet.</p><p><strong>2. Fachkraeftemangel.</strong> KI als Force-Multiplier - vorhandene Fachkraefte schaffen das Zwei- bis Dreifache, Routine wandert an Maschinen. Autonome Bagger (Built Robotics, SafeAI) arbeiten im 24/7-Schichtbetrieb. 3D-Beton-Druck (ICON, COBOD) baut ein Einfamilienhaus mit drei Personen in 24 Stunden statt zwoelf in sechs Wochen. KI-Co-Piloten erlauben Bauleitern, zwei bis drei Baustellen statt einer zu fuehren.</p><p><strong>3. Laehmende Buerokratie.</strong> Generative KI als Dokumentations- und Antrags-Roboter - was heute Tage dauert, geht in Minuten. KI-gestuetzte Bauantraege (dGRO, Approval AI) generieren komplette Unterlagen aus BIM-Modellen und pruefen gegen lokale Bauordnungen: aus 4-6 Wochen werden 2-4 Tage. Compliance-Tools markieren Maengel in Echtzeit. Bauleiter sparen 5-8 Stunden pro Woche, die heute in Formulare fliessen.</p><p><em>Die entscheidende Einsicht: Die drei Belastungen verstaerken sich gegenseitig - und KI ist das einzige Werkzeug, das an allen drei gleichzeitig ansetzt. Wer KI ignoriert, optimiert in einer Dimension und verliert in den anderen zwei.</em></p><h3>Teil 2 - Fuenf Gedankenexperimente fuer uebermorgen</h3><p>Interaktiv, vom Publikum gewaehlt. Christoph Holz spielt mit allen gemeinsam durch, was passiert, wenn man die heutigen Hebel konsequent weiterdenkt:</p><ol><li><strong>Der selbstplanende Hochbau:</strong> Was bleibt vom Architekten, wenn die KI in Minuten 200 Varianten liefert - und alle bauphysikalisch geprueft?</li><li><strong>Die selbstfahrende Baustelle:</strong> Wer haftet, wenn der autonome Bagger die Leitung trifft - und wer profitiert, wenn er sie nicht trifft?</li><li><strong>Generalunternehmer ohne Mitarbeiter:</strong> Koennen Plattformen wie Uber fuer Handwerker funktionieren - oder zerstoeren sie die Qualitaet, die das Geschaeft ausmacht?</li><li><strong>Beton mit Algorithmus:</strong> Wann optimiert die KI Rezepturen schneller als jedes Materiallabor - und wem gehoert das resultierende Patent?</li><li><strong>BIM zu Ende gedacht:</strong> Wenn jedes Bauteil weiss, was es ist und wo es hin will - brauchen wir dann noch Bauleiter?</li></ol><h3>Was die Keynote leistet</h3><p>Kein Technologie-Vortrag, kein Folienzwang, kein abstraktes Zukunftsblabla. Sondern ein Trainingslager fuer unternehmerisches Denken in einer Branche, deren Geschaeftsmodelle gerade neu sortiert werden. Am Ende stehen keine Prognosen, sondern Optionen - und das Selbstvertrauen, sie zu gestalten.</p><p><strong>Wer versteht wie, gewinnt.</strong></p>$keynote_long$,
		$keynote_short$Auftragsflaute, Fachkraeftemangel und Buerokratie halten die Bauwirtschaft in Atem. Kann Kuenstliche Intelligenz das alles auf einmal loesen? Natuerlich nicht! Unternehmer loesen ihre Probleme schon selber. Aber Christoph Holz zeigt drei Hebel, die heute schon Stueckkosten, Kapitalbindung und Stehzeiten druecken - und fuenf Gedankenexperimente fuers Uebermorgen, die das Publikum selbst auswaehlt. Konkret, interaktiv, ueberraschend. Wer versteht wie, gewinnt.$keynote_short$,
		$speaker$Christoph Holz, Dipl.-Informatiker und Raumfahrttechniker, ist Keynote Speaker, Hochschullehrer fuer Digitale Ethik und Business Angel. Als ehemaliger Silicon-Valley-Entrepreneur investiert er in Kuenstliche Intelligenz, Robotik und Blockchain von Australien bis Singapur. Sein Podcast "Digital Sensemaker" beleuchtet Sinn und Unsinn der Digitalisierung. Einer breiten Oeffentlichkeit ist er als TV-Experte (Sat.1, RTL, n-tv) bekannt. Auf der Buehne verbindet er Technologie, Gesellschaft und Wirtschaft mit Sprachwitz, eindrucksvollen Bildern und aussergewoehnlichen Beispielen.$speaker$
	)
on conflict (id) do update
set
	keynote_title = excluded.keynote_title,
	keynote_summary = excluded.keynote_summary,
	theme = excluded.theme,
	audience = excluded.audience,
	language = excluded.language,
	subtitle = excluded.subtitle,
	moderation = excluded.moderation,
	keynote_long = excluded.keynote_long,
	keynote_short = excluded.keynote_short,
	speaker = excluded.speaker,
	updated_at = now();

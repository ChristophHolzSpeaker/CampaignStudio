create table landing_page_asset_sets (
	id serial primary key,
	asset_key text not null,
	assets_json jsonb not null,
	is_active boolean not null default true,
	created_at timestamp with time zone default now() not null,
	updated_at timestamp with time zone default now() not null,
	constraint landing_page_asset_sets_asset_key_not_blank check (length(trim(asset_key)) > 0)
);

create unique index landing_page_asset_sets_asset_key_key on landing_page_asset_sets (asset_key);
create unique index landing_page_asset_sets_single_active_idx on landing_page_asset_sets (is_active)
where is_active;

insert into
	landing_page_asset_sets (asset_key, assets_json, is_active)
values
	(
		'default',
		$$
		{
		  "heroDefaults": {
		    "videoEmbedUrl": "https://www.youtube.com/watch?v=mpbtCg2NSUs",
		    "videoThumbnailUrl": "https://cdn.prod.website-files.com/61263e0de406f497361dca55/6130408552ea140d707aab8e_christoph-contact-bg.jpg",
		    "videoThumbnailAlt": "Keynote speaker presenting to a business audience",
		    "primaryCtaLabelDefault": "Request Speaking Availability",
		    "primaryCtaHref": "https://christophholz.com/contact"
		  },
		  "fixedLogosRibbon": {
		    "label": "Trusted in executive and innovation contexts",
		    "logos": [
		      {
		        "name": "Executive Summits",
		        "imageUrl": "/CeBIT-Logo.png",
		        "alt": "Executive Summits wordmark placeholder"
		      },
		      {
		        "name": "Innovation Forums",
		        "imageUrl": "/cisco-svgrepo-com.svg",
		        "alt": "Innovation Forums wordmark placeholder"
		      },
		      {
		        "name": "Corporate Offsites",
		        "imageUrl": "/redbull-logo-svgrepo-com.svg",
		        "alt": "Corporate Offsites wordmark placeholder"
		      }
		    ]
		  },
		  "fixedProofOfPerformance": {
		    "title": "What organizers say after the keynote",
		    "testimonials": [
		      {
		        "quote": "Christoph turned a complex AI topic into actionable direction our leadership team could align around immediately.",
		        "name": "Alex Morgan",
		        "role": "Director of Strategy",
		        "company": "Enterprise Leadership Forum",
		        "photoUrl": "https://images.unsplash.com/photo-1494790108377-be9c29b29330",
		        "photoAlt": "Portrait placeholder for Alex Morgan",
		        "rating": 5,
		        "featured": true
		      },
		      {
		        "quote": "Clear, commercially grounded, and highly relevant to executives deciding how to apply AI in real operations.",
		        "name": "Jordan Reyes",
		        "role": "Head of Operations",
		        "company": "Global Services Summit",
		        "photoUrl": "https://images.unsplash.com/photo-1500648767791-00dcc994a43e",
		        "photoAlt": "Portrait placeholder for Jordan Reyes",
		        "rating": 5
		      }
		    ]
		  },
		  "bookingDefaults": {
		    "defaultSectionTitle": "Tell us about your event goals",
		    "defaultSectionDescription": "Share your audience, timeline, and outcomes. We will respond quickly with fit and next steps.",
		    "primaryCtaLabelDefault": "Start Booking Request",
		    "calendlyUrl": "https://calendly.com/christophholz/speaking-discovery",
		    "trustNote": "This page uses curated campaign assets and messaging for internal MVP generation.",
		    "formDisclaimer": "By submitting, you agree to be contacted regarding speaking availability and event fit."
		  },
		  "complianceDefaults": {
		    "privacyPolicyUrl": "https://christophholz.com/privacy",
		    "contactEmail": "team@christophholz.com",
		    "businessAddress": "Vienna, Austria",
		    "phone": "+43 1 555 0100",
		    "copyrightText": "© Christoph Holz. All rights reserved.",
		    "additionalLinks": [
		      {
		        "label": "Imprint",
		        "href": "https://christophholz.com/imprint"
		      }
		    ]
		  }
		}
		$$::jsonb,
		true
	)
on conflict (asset_key) do update
set
	assets_json = excluded.assets_json,
	is_active = excluded.is_active,
	updated_at = now();

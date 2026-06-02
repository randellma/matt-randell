# Full domain transfer to GCP Cloud Domains

`mattrandell.com` is transferred from NearlyFreeSpeech into GCP Cloud Domains rather than keeping NearlyFreeSpeech as the registrar with nameservers pointing at Cloud DNS. This consolidates registrar and DNS management under one provider, keeping everything Terraform-manageable in a single place.

The main rejected alternative was Cloud DNS-only: NearlyFreeSpeech stays registrar, nameservers delegate to Cloud DNS. That approach splits ownership between two providers with no meaningful benefit. The notable trade-off is a 60-day re-transfer lock after the transfer completes.

import django.core.validators
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("books", "0003_book_cover_pages_review_favorite")]

    operations = [
        migrations.AddField(
            model_name="author",
            name="country",
            field=models.CharField(
                blank=True,
                db_index=True,
                help_text="Nationality of the author, as an ISO 3166-1 alpha-2 code (BR, JP, PT...). Drives the globe on the Home.",
                max_length=2,
                validators=[django.core.validators.RegexValidator(message="Use an ISO 3166-1 alpha-2 code, e.g. BR.", regex="^[A-Z]{2}$")],
            ),
        ),
    ]

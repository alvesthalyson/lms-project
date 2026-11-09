from django.db import transaction

from ..models import Role, User


@transaction.atomic
def register_member(
    *, email: str, password: str, first_name: str, last_name: str, phone: str = "", address: str = ""
) -> User:
    """
    Public self-registration. The role is decided here, never by the client:
    whatever the request body says, a self-registered account is a MEMBER and
    cannot be made staff except by an admin (POST /users/).

    The library card number is derived from the primary key ("M-000007"),
    which is unique by construction and needs no counter table.
    """
    user = User.objects.create_user(
        email=email,
        password=password,
        first_name=first_name,
        last_name=last_name,
        phone=phone,
        address=address,
        role=Role.MEMBER,
    )
    user.member_number = f"M-{user.pk:06d}"
    user.save(update_fields=["member_number"])
    return user


@transaction.atomic
def update_profile(*, user: User, validated_data: dict) -> User:
    """Members edit only their own contact data (see ProfileUpdateSerializer)."""
    for field, value in validated_data.items():
        setattr(user, field, value)
    user.save(update_fields=[*validated_data.keys()] or None)
    return user


@transaction.atomic
def change_password(*, user: User, new_password: str) -> None:
    user.set_password(new_password)
    user.save(update_fields=["password"])

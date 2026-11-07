import factory

from apps.users.models import Role, User


class UserFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = User
        skip_postgeneration_save = True

    email = factory.Sequence(lambda n: f"user{n}@example.com")
    first_name = "Test"
    last_name = factory.Sequence(lambda n: f"User{n}")
    password = factory.django.Password("S3cure-passphrase")  # hashed with the test hasher
    role = Role.MEMBER
    member_number = None
    is_active = True
    is_blocked = False


class MemberFactory(UserFactory):
    role = Role.MEMBER
    member_number = factory.Sequence(lambda n: f"M-{n + 1:06d}")


class LibrarianFactory(UserFactory):
    role = Role.LIBRARIAN


class AdminFactory(UserFactory):
    role = Role.ADMIN

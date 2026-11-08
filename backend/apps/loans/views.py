from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.core.mixins import MemberScopedQuerysetMixin
from apps.core.permissions import IsAdmin, IsLibrarian

from .filters import FineFilter, LoanFilter
from .models import Fine, Loan
from .serializers import (
    FineActionSerializer,
    FineCreateSerializer,
    FineSerializer,
    LoanCreateSerializer,
    LoanReturnResponseSerializer,
    LoanReturnSerializer,
    LoanSerializer,
)
from .services import fine_service, loan_service


class LoanViewSet(MemberScopedQuerysetMixin, viewsets.GenericViewSet):
    """List/detail/renew for everyone signed in (members see their own); create/return for staff."""

    queryset = Loan.objects.select_related("member", "copy__book")
    serializer_class = LoanSerializer
    filterset_class = LoanFilter
    ordering_fields = ["loaned_at", "due_date", "returned_at"]
    ordering = ["-loaned_at", "-id"]
    member_field = "member"

    def get_permissions(self):
        if self.action in ("create", "return_loan"):
            return [IsLibrarian()]
        return [IsAuthenticated()]

    def list(self, request):
        page = self.paginate_queryset(self.filter_queryset(self.get_queryset()))
        return self.get_paginated_response(LoanSerializer(page, many=True).data)

    def retrieve(self, request, pk=None):
        return Response(LoanSerializer(self.get_object()).data)

    def create(self, request):
        serializer = LoanCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        loan = loan_service.create_loan(issued_by=request.user, **serializer.validated_data)
        return Response(LoanSerializer(loan).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="renew")
    def renew(self, request, pk=None):
        loan = loan_service.renew_loan(loan=self.get_object(), renewed_by=request.user)
        return Response(LoanSerializer(loan).data)

    @action(detail=True, methods=["post"], url_path="return", url_name="return")
    def return_loan(self, request, pk=None):
        serializer = LoanReturnSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = loan_service.return_loan(
            loan=self.get_object(), received_by=request.user, **serializer.validated_data
        )
        # Pass the model instances: LoanReturnResponseSerializer does the nesting itself.
        body = {"loan": result.loan, "fine": result.fine}
        return Response(LoanReturnResponseSerializer(body).data)


class FineViewSet(MemberScopedQuerysetMixin, viewsets.GenericViewSet):
    queryset = Fine.objects.select_related("loan__member", "loan__copy__book")
    serializer_class = FineSerializer
    filterset_class = FineFilter
    ordering_fields = ["created_at", "amount"]
    ordering = ["-created_at", "-id"]
    member_field = "loan__member"

    def get_permissions(self):
        if self.action in ("create", "pay"):
            return [IsLibrarian()]
        if self.action == "waive":
            return [IsAdmin()]
        return [IsAuthenticated()]

    def list(self, request):
        page = self.paginate_queryset(self.filter_queryset(self.get_queryset()))
        return self.get_paginated_response(FineSerializer(page, many=True).data)

    def retrieve(self, request, pk=None):
        return Response(FineSerializer(self.get_object()).data)

    def create(self, request):
        serializer = FineCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        fine = fine_service.create_manual_fine(created_by=request.user, **serializer.validated_data)
        return Response(FineSerializer(fine).data, status=status.HTTP_201_CREATED)

    def _note(self, request) -> str:
        serializer = FineActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return serializer.validated_data.get("note", "")

    @action(detail=True, methods=["post"])
    def pay(self, request, pk=None):
        fine = fine_service.pay_fine(fine=self.get_object(), paid_by=request.user, note=self._note(request))
        return Response(FineSerializer(fine).data)

    @action(detail=True, methods=["post"])
    def waive(self, request, pk=None):
        fine = fine_service.waive_fine(
            fine=self.get_object(), waived_by=request.user, note=self._note(request)
        )
        return Response(FineSerializer(fine).data)

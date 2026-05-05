from urllib.parse import parse_qs
from channels.middleware import BaseMiddleware
from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.tokens import AccessToken
from rest_framework_simplejwt.exceptions import TokenError, InvalidToken


class JWTAuthMiddleware(BaseMiddleware):
    """
    Authenticates WebSocket connections via a JWT token
    passed as a query parameter: ?token=<access_token>
    """

    async def __call__(self, scope, receive, send):
        query_string = scope.get('query_string', b'').decode('utf-8')
        params = parse_qs(query_string)
        token_list = params.get('token', [])

        if token_list:
            scope['user'] = await self.get_user_from_token(token_list[0])
        else:
            scope['user'] = AnonymousUser()

        return await super().__call__(scope, receive, send)

    @database_sync_to_async
    def get_user_from_token(self, token_key):
        from django.contrib.auth import get_user_model
        User = get_user_model()
        try:
            token = AccessToken(token_key)
            user_id = token.get('user_id')
            if not user_id:
                return AnonymousUser()
            return User.objects.select_related().get(id=user_id, is_active=True)
        except (TokenError, InvalidToken, User.DoesNotExist):
            return AnonymousUser()


def JWTAuthMiddlewareStack(inner):
    return JWTAuthMiddleware(inner)

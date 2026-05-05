from rest_framework import serializers
from apps.accounts.serializers import UserSerializer
from .models import Room, RoomMember


class RoomMemberSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    class Meta:
        model = RoomMember
        fields = ('id', 'user', 'joined_at', 'is_online', 'last_seen')


class RoomSerializer(serializers.ModelSerializer):
    owner = UserSerializer(read_only=True)
    online_count = serializers.SerializerMethodField()
    member_count = serializers.SerializerMethodField()
    is_owner = serializers.SerializerMethodField()

    class Meta:
        model = Room
        fields = (
            'id', 'code', 'name', 'owner', 'created_at', 'updated_at',
            'is_active', 'is_public', 'online_count', 'member_count', 'is_owner'
        )
        read_only_fields = ('id', 'code', 'created_at', 'updated_at', 'owner')

    def get_online_count(self, obj):
        return obj.members.filter(is_online=True).count()

    def get_member_count(self, obj):
        return obj.members.count()

    def get_is_owner(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.owner_id == request.user.id
        return False


class RoomCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Room
        fields = ('name', 'is_public')

    def create(self, validated_data):
        validated_data['owner'] = self.context['request'].user
        return super().create(validated_data)


class RoomDetailSerializer(RoomSerializer):
    members = RoomMemberSerializer(many=True, read_only=True)

    class Meta(RoomSerializer.Meta):
        fields = RoomSerializer.Meta.fields + ('members',)

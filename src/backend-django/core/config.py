"""Django AppConfig classes for all domain apps."""


from django.apps import AppConfig


class UsersConfig(AppConfig):
    name = "apps.users"
    verbose_name = "Users"


class FilesConfig(AppConfig):
    name = "apps.files"
    verbose_name = "Files"


class ConfigAppConfig(AppConfig):
    name = "apps.config"
    verbose_name = "Configuration"


class ReverseRoomsConfig(AppConfig):
    name = "apps.reverse_rooms"
    verbose_name = "Reverse Rooms"


class AdminDomainConfig(AppConfig):
    name = "apps.admin_domain"
    verbose_name = "Admin Domain"


class SpeedtestConfig(AppConfig):
    name = "apps.speedtest"
    verbose_name = "Speedtest"


class InstanceConfig(AppConfig):
    name = "apps.instance"
    verbose_name = "Instance"

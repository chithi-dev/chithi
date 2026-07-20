import { gql } from '@urql/core';

// ─── Queries ───────────────────────────────────────────────────────────────────

export const CONFIG_QUERY = gql`
  query Config {
    config {
      total_storage_limit
      max_file_size_limit
      default_expiry
      default_number_of_downloads
      site_description
      download_configs
      time_configs
      allowed_file_types
      banned_file_types
      allow_uploads
    }
  }
`;

export const ONBOARDING_QUERY = gql`
  query Onboarding {
    onboarding {
      is_configured
      has_users
    }
  }
`;

export const ME_QUERY = gql`
  query Me {
    me {
      id
      username
      email
      created_at
    }
  }
`;

export const INSTANCE_INFO_QUERY = gql`
  query InstanceInformation {
    instance_information {
      backend_version
      python_version
      platform
    }
  }
`;

export const INSTANCE_STATS_QUERY = gql`
  query InstanceStatistics {
    instance_statistics {
      total_files
      active_files
      expired_files
      total_storage_used
      total_users
    }
  }
`;

export const FILE_INFO_QUERY = gql`
  query FileInfo($slug: String!) {
    file_info(slug: $slug) {
      id
      key
      filename
      size
      number_of_files
      download_count
      created_at
      expires_at
      expire_after_n_download
      is_expired
    }
  }
`;

export const ADMIN_FILES_QUERY = gql`
  query AdminFiles($page: Int, $size: Int, $search: String) {
    admin_files(page: $page, size: $size, search: $search) {
      items {
        id
        key
        filename
        size
        number_of_files
        download_count
        created_at
        expires_at
        expire_after_n_download
        is_expired
      }
      total
      page
      size
      pages
    }
  }
`;

export const USERS_QUERY = gql`
  query Users {
    users {
      id
      username
      email
      created_at
    }
  }
`;

// ─── Mutations ─────────────────────────────────────────────────────────────────

export const LOGIN_MUTATION = gql`
  mutation Login($username: String!, $password: String!) {
    login(username: $username, password: $password) {
      access
      refresh
    }
  }
`;

export const LOGOUT_MUTATION = gql`
  mutation Logout {
    logout
  }
`;

export const UPLOAD_FILE_MUTATION = gql`
  mutation UploadFile(
    $filename: String!
    $expire_after: Int!
    $expire_after_n_download: Int!
    $number_of_files: Int
  ) {
    upload_file(
      filename: $filename
      expire_after: $expire_after
      expire_after_n_download: $expire_after_n_download
      number_of_files: $number_of_files
    ) {
      id
      key
      filename
      size
      number_of_files
      download_count
      created_at
      expires_at
      expire_after_n_download
      is_expired
    }
  }
`;

export const COMPLETE_ONBOARDING_MUTATION = gql`
  mutation CompleteOnboarding(
    $username: String!
    $email: String!
    $password: String!
    $site_description: String!
  ) {
    complete_onboarding(
      username: $username
      email: $email
      password: $password
      site_description: $site_description
    ) {
      access
      refresh
      onboarded
    }
  }
`;

export const DELETE_FILE_MUTATION = gql`
  mutation DeleteFile($id: ID!) {
    delete_file(id: $id)
  }
`;

export const CREATE_USER_MUTATION = gql`
  mutation CreateUser($username: String!, $password: String!, $email: String) {
    create_user(username: $username, password: $password, email: $email) {
      id
      username
      email
      created_at
    }
  }
`;

export const UPDATE_USER_MUTATION = gql`
  mutation UpdateUser($id: ID!, $username: String, $email: String) {
    update_user(id: $id, username: $username, email: $email) {
      id
      username
      email
      created_at
    }
  }
`;

export const DELETE_USER_MUTATION = gql`
  mutation DeleteUser($id: ID!) {
    delete_user(id: $id)
  }
`;

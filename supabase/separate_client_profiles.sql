-- Mark existing portal identities so they never appear in internal team directories,
-- even if portal access is later unlinked from the client.
update myntmore.profiles as profile
set department = 'client'
from myntmore.clients as client
where client.user_id = profile.id
  and client.user_id is not null;

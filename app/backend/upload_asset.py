"""This module allows uploading new assets to a google ads account.

This module allows uploading assets threw the assetMG tool, and assigning them
to a list of adgroups utilaizing the mutate module.
"""

from googleads import adwords
import mutate
from service import Service_Class


def upload_html5_asset(client, account, asset_name, path, adgroups):
  """Upload html5 asset and assign to ad groups if given."""
  asset_service = Service_Class.get_asset_service(client)

  with open(path, 'rb') as html_handle:
    html_data = html_handle.read()

  media_bundle_asset = {
      'xsi_type': 'MediaBundleAsset',
      'assetName': asset_name,
      'mediaBundleData': html_data
  }
  operation = {'operator': 'ADD', 'operand': media_bundle_asset}

  asset = asset_service.mutate([operation])['value'][0]

  if asset:

    new_asset = {
        'id': asset['assetId'],
        'name': asset['assetName'],
        'type': asset['Asset.Type'],
    }

    return _assign_new_asset_to_adgroups(client, account, new_asset, adgroups)

  else:
    return {'status': 3}  # status 3 - could not upload


def upload_yt_video_asset(client, account, asset_name, url, adgroups):
  """Upload YT video asset and assign to ad groups if given."""
  asset_service = Service_Class.get_asset_service(client)

  video_id = url.split('=')[-1]

  vid_asset = {
      'xsi_type': 'YouTubeVideoAsset',
      'assetName': asset_name,
      'youTubeVideoId': video_id
  }

  operation = {'operator': 'ADD', 'operand': vid_asset}

  asset = asset_service.mutate([operation])['value'][0]

  if asset:

    new_asset = {
        'id': asset['assetId'],
        'name': asset['assetName'],
        'type': asset['Asset.Type'],
        'video_id': video_id
    }

    return _assign_new_asset_to_adgroups(client, account, new_asset, adgroups)

  else:
    return {'status': 3} # status 3 - could not upload


def upload_image_asset(client, account, asset_name, path, adgroups):
  """Upload image asset and assign to ad groups if given."""
  asset_service = Service_Class.get_asset_service(client)

  with open(path, 'rb') as image_handle:
    image_data = image_handle.read()

  # Construct media and upload image asset.
  image_asset = {
      'xsi_type': 'ImageAsset',
      'assetName': asset_name,
      'imageData': image_data,
  }

  operation = {'operator': 'ADD', 'operand': image_asset}

  asset = asset_service.mutate([operation])['value'][0]

  if asset:

    new_asset = {
        'id': asset['assetId'],
        'name': asset['assetName'],
        'type': asset['Asset.Type'],
    }

    return _assign_new_asset_to_adgroups(client, account, new_asset, adgroups)

  else:
    return {'status' : 3} # status 3 - could not upload


def upload_text_asset(client, account, text_type, name, text, adgroups):
  """Upload text asset and assign to ad groups."""
  asset = {
      'id': None,
      'name': name,
      'type': 'TextAsset',
      'text_type': text_type,
      'asset_text': text
  }

  return _assign_new_asset_to_adgroups(client, account, asset,adgroups, text_type)


def _assign_new_asset_to_adgroups(client,account, asset, adgroups, text_type ='descriptions'):
  """Assigns the new asset uploaded to the given adgroups, using the mutate module. """
  # common_typos_disable
  successeful_assign = []
  unsuccesseful_assign = []

  for ag in adgroups:
    # mutate_ad returns None if it finishes succesfully
    if mutate.mutate_ad(client, account, ag, asset, 'ADD', text_type):
      unsuccesseful_assign.append(ag)
    else:
      successeful_assign.append(ag)

  # assignment status: 0 - succesfull, 1 - partialy succesfull, 2 - unsuccesfull
  status = 2

  # if successfully assigend only to some ad groups
  if successeful_assign and unsuccesseful_assign:
    status = 1

  # if successefully assigned to all ad groups
  elif successeful_assign:
    status = 0

  return {
      'status': status,
      'successfull': successeful_assign,
      'unsuccessfull': unsuccesseful_assign
  }


def upload(client,
           account,
           asset_type,
           asset_name,
           asset_text='',
           path='',
           url='',
           adgroups=[]):
  """Central function. Routes to the relevant function based on the asset type.

  Args:
    client : adwords api client.
    account : account id, to which the asset will be uploaded.
    asset_type : image,video,text,html5. The relevant upload func is triggered
    according to the type.
    asset_name : name to assign to the asset. has to be unique.
    asset_text : for text assets. Text assets must be assigned to at least one
    adgroup inorder to upload.
    path : for image and html5 assets. path the file on the users computer.
    url : for YT videos.,
    adgroups : a list of adgroups to assign the asset to.
  Returns:
    exit code
    exit message
  """
  client.SetClientCustomerId(account)

  if asset_type == 'IMAGE':
    return upload_image_asset(client, account, asset_name, path, adgroups)

  if asset_type in ['descriptions', 'headlines']:
    return upload_text_asset(client, account, asset_type, asset_name,
                             asset_text, adgroups)

  if asset_type == 'YOUTUBE_VIDEO':
    return upload_yt_video_asset(client, account, asset_name, url, adgroups)

  if asset_type == 'MEDIA_BUNDLE':
    print(upload_html5_asset(client, account, asset_name, path, adgroups))


# Uncomment this section for module testing

# def main(client):
#   upload(
#       client,
#       9489090398,
#       'html5',
#       'generic html5',
#       path = html_path,
#       adgroups=[97909190375])
#
#
# if __name__ == '__main__':
#   adwords_client = adwords.AdWordsClient.LoadFromStorage()
#   main(adwords_client)

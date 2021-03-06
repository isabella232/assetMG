/**
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import {
  Component,
  ViewChild,
  OnChanges,
  SimpleChanges,
  Input,
  ChangeDetectorRef,
  EventEmitter,
  Output,
} from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort, MatSortable } from '@angular/material/sort';
import { SelectionModel } from '@angular/cdk/collections';
import { AssetAdGroups, Asset, AssetConnType, AssetType } from '../model/asset';
import { AssetService } from '../services/asset.service';
import { AccountAGs, AdGroup } from '../model/account';
import { BehaviorSubject, Subscription } from 'rxjs';

/** checkmark options allows the storing of states for all three checkboxes at the same time
 * adGroup, headlines and description - to be accessed by AssetConn
 */
export enum AssetConn {
  ADGROUP = 0,
  HEADLINE = 1,
  DESC = 2,
}
export type checkBoxOptions = Array<boolean>;

/** Each row in the ad groups table is represented by one of these objects */
export interface AdGroupRow extends AdGroup {
  name: string;
  id: number;
  campaign: string;
  campaign_id: number;
  performance: string;
  headlinePerformance: string;
  descriptionPerformance: string;

  /** Every adgroups has to store the edited/disabled state of all three checkmarks  */
  disabled: checkBoxOptions;
  isEdited: checkBoxOptions;
}
/**
 * This component works in two modes: Update and Upload
 * . Update mode has 3 selection columns (1 for non-text assets and 2 for text assets)
 *   Depending on the selected asset type, the selection columns are visible
 * . Upload mode only makes use of the adgroup selection column
 */
@Component({
  selector: 'app-account-struct',
  templateUrl: './account-struct.component.html',
  styleUrls: ['./account-struct.component.css'],
})
export class AccountStructComponent implements OnChanges {
  private _subscriptions: Subscription[] = [];

  /** Memebers that represent the data that will be displayed */
  private _account: AccountAGs;
  private _activeAsset: Asset;
  private _adGroupRows: AdGroupRow[];
  private _assetToAdgroups: AssetAdGroups;
  assetConn = AssetConn; /** connection types to be used in the html file */
  isTextAsset: boolean; /** When this is set, Healine and Description columns appear and main selection column disappears */
  filter: string;

  displayedColumns$ = new BehaviorSubject<string[]>(null);
  /** Members that represent the table UI
   * There are three selectable columns; one for non-text assets
   * 2 for text assets (Headlines and Descriptions)
   * the visibility of the columns depends on the asset type
   */
  nonTextAssetCols: string[] = ['adgroup-sel', 'adgroup', 'performance', 'campaign'];
  textAssetCols: string[] = ['headline-sel', 'headline-performance', 'desc-sel', 'desc-performance', 'adgroup', 'campaign'];

  dataSource: MatTableDataSource<AdGroupRow>;
  adgroup_sel = new SelectionModel<AdGroupRow>(true, []);
  headline_sel = new SelectionModel<AdGroupRow>(true, []);
  description_sel = new SelectionModel<AdGroupRow>(true, []);
  pageSizeOptions = [10, 25, 50];

  @Input()
  set account(account: AccountAGs) {
    this._account = account;
  }
  get account(): AccountAGs {
    return this._account;
  }

  @Input()
  set activeAsset(asset: Asset) {
    this._activeAsset = asset;
  }
  get activeAsset(): Asset {
    return this._activeAsset;
  }

  @Input() uploadMode: boolean = false;
  @Output() selectionMade: EventEmitter<boolean> = new EventEmitter<boolean>();
  @ViewChild(MatPaginator, { static: true }) paginator: MatPaginator;
  @ViewChild(MatSort, { static: true }) sort: MatSort;

  constructor(
    private dataService: AssetService,
    private _changeDetectorRef: ChangeDetectorRef
  ) {}
  ngOnChanges(changes: SimpleChanges): void {
    // Get new adgroups if active account has changed
    if (
      changes.account?.currentValue?.id != changes.account?.previousValue?.id
    ) {
      this.addAdGroupsToTable();
    }
    if (changes.uploadMode) {
      this.displayedColumns$.next(this.getDisplayedColumns());
      this.pageSizeOptions = [5, 25, 50];
      this._changeDetectorRef.detectChanges();
    }
  }

  ngOnInit(): void {
    // Refresh asset to ad group
    this._subscriptions.push(
      this.dataService.activeAssetAdGroups$.subscribe((adGroups) => {
        this._assetToAdgroups = adGroups;
        if (this.dataSource?.paginator) {
          this.dataSource.paginator.firstPage();
        }
        this.updateRowSelections();
      })
    );

    // Refresh the asset details in the table if asset changes
    this._subscriptions.push(
      this.dataService.activeAsset$.subscribe((asset) => {
        if (asset) {
          this._activeAsset = asset;
          // Update table according to asset type
          this.isTextAsset = this.activeAsset.type == AssetType.TEXT;
          this.displayedColumns$.next(this.getDisplayedColumns());
          this._changeDetectorRef.detectChanges();

          // Reset the filter if any
          this.filter = '';
          this.dataSource.filter = '';
        }
      })
    );
  }

  ngOnDestroy() {
    for (let sub of this._subscriptions) {
      sub.unsubscribe();
    }
  }

  addAdGroupsToTable() {
    this._adGroupRows = this.createAdGroupRows();
    // Assign the data to the data source for the table to render
    this.dataSource = new MatTableDataSource(this._adGroupRows);
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;

    // Adjust sorting criteria
    this.dataSource.sortingDataAccessor = (item, property) => {
      switch (property) {
        case 'adgroup-sel':
          return this.adgroup_sel.selected.includes(item);
        case 'headline-sel':
        case 'desc-sel':
          return (
            this.headline_sel.selected.includes(item) ||
            this.description_sel.selected.includes(item)
          );
        default:
          return item[property];
      }
    };
  }

  getDisplayedColumns(): string[] {
    let cols = [];
    this.showAdGroupColOnly()
      ? (cols = this.nonTextAssetCols)
      : (cols = this.textAssetCols);
    return cols;
  }

  /** Creates adGroup rows for all account adgroups */
  private createAdGroupRows(): AdGroupRow[] {
    let adgroups = this.account.adgroups;
    // Add any additional fields here
    adgroups.forEach(ag => {
      (ag as AdGroupRow).isEdited = [false, false, false];
      (ag as AdGroupRow).disabled = [false, false, false];
    });
    return adgroups as AdGroupRow[];
  }

  updateRowSelections() {
    // Clear previous selections
    this.adgroup_sel.clear();
    this.headline_sel.clear();
    this.description_sel.clear();

    // Filter the rows that need to be selected
    if (this._assetToAdgroups) {
      if (this.showAdGroupColOnly()) {
        this.selectAdGroup(AssetConn.ADGROUP);
      } else {
        this.selectAdGroup(AssetConn.HEADLINE);
        this.selectAdGroup(AssetConn.DESC);
      }
    }
    this._changeDetectorRef.detectChanges();
  }

  selectAdGroup(assetConn: AssetConn) {
    let connType: AssetConnType = AssetConnType.ADGROUP;
    switch (assetConn) {
      case AssetConn.HEADLINE:
        connType = AssetConnType.HEADLINE;
        break;
      case AssetConn.DESC:
        connType = AssetConnType.DESC;
        break;
    }
    let selectAdGroups = this._assetToAdgroups?.get(connType);
    if (selectAdGroups) {
      let selectedRows = this._adGroupRows.filter((agRow) =>
        selectAdGroups.some((adGroup) => agRow.id == adGroup.id)
      );

      this._adGroupRows.map(agRow => {
        selectAdGroups.filter(ag => ag.id == agRow.id).forEach(adGroup => {
          switch (adGroup.performance_type) {
            case 'adgroup': {
              agRow.performance = adGroup.performance;
              break;
            }
            case 'headlines': {
              agRow.headlinePerformance = adGroup.performance;
              break;
            }
            case 'descriptions': {
              agRow.descriptionPerformance = adGroup.performance;
              break;
            }
            default: {
              agRow.performance = adGroup.performance;
              break;
            }
          }
        })
      });

      let selArray = this.getSelectionArray(assetConn);
      selArray.select(...selectedRows);
    }
  }

  resetEditedRows() {
    this.dataSource?.data?.forEach((row) => {
      row.isEdited = [false, false, false];
    });
  }

  sortBySelection() {
    if (this.showAdGroupColOnly()) {
      this.sort.sort(<MatSortable>{ id: 'adgroup-sel', start: 'desc' });
    } else {
      this.sort.sort(<MatSortable>{ id: 'desc-sel', start: 'desc' });
      this.sort.sort(<MatSortable>{ id: 'headline-sel', start: 'desc' });
    }
    this.sort.direction = 'desc';
    this.dataSource.sort = this.sort;
    this.dataSource.sort.sortChange.emit();
  }

  applyFilter(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSource.filter = filterValue.trim().toLowerCase();

    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
    // console.log('Filter ', event);
    // console.log('value:', filterValue);
  }

  toggleSelection(agRow: AdGroupRow, assetConn: AssetConn) {
    if (agRow) {
      // Toggle the edited property then update the selection array
      switch (assetConn) {
        case AssetConn.HEADLINE:
          agRow.isEdited[AssetConn.HEADLINE] = !agRow.isEdited[
            AssetConn.HEADLINE
          ];
          break;
        case AssetConn.DESC:
          agRow.isEdited[AssetConn.DESC] = !agRow.isEdited[AssetConn.DESC];
          break;
        default:
          agRow.isEdited[AssetConn.ADGROUP] = !agRow.isEdited[
            AssetConn.ADGROUP
          ];
          break;
      }

      this.getSelectionArray(assetConn).toggle(agRow);
      this._changeDetectorRef.markForCheck();

      // Now that there is a selection change check if at least one row is selected
      // This is needed to enable the "Add Asset" button in the upload dialog
      // Note: the check is only made on the adgroup selection array because
      // the upload button opnly supports one selection column (adgroup_sel)
      this.selectionMade.emit(!this.adgroup_sel.isEmpty());
    }
  }

  /** Whether the number of selected elements matches the total number of rows. */
  isAllSelected(assetConn: AssetConn) {
    let selArr = this.getSelectionArray(assetConn);
    const numSelected = selArr.selected.length;
    const numRows = this.dataSource.data.length;
    return numSelected === numRows;
  }

  /** Selects all rows if they are not all selected; otherwise clear selection. */
  masterToggle(assetConn: AssetConn) {
    this.isAllSelected(assetConn)
      ? this.dataSource.data.forEach((row) => this.unselectRow(row, assetConn))
      : this.dataSource.data.forEach((row) => this.selectRow(row, assetConn));
  }

  getSelectionArray(assetConn: AssetConn) {
    let selArr;
    switch (assetConn) {
      case AssetConn.HEADLINE:
        selArr = this.headline_sel;
        break;
      case AssetConn.DESC:
        selArr = this.description_sel;
        break;
      default:
        selArr = this.adgroup_sel;
        break;
    }
    return selArr;
  }

  private selectRow(row: AdGroupRow, assetConn: AssetConn) {
    let selArr = this.getSelectionArray(assetConn);
    if (!selArr.isSelected(row)) {
      this.toggleSelection(row, assetConn);
    }
  }

  private unselectRow(row: AdGroupRow, assetConn: AssetConn) {
    let selArr = this.getSelectionArray(assetConn);
    if (selArr.isSelected(row)) {
      this.toggleSelection(row, assetConn);
    }
  }

  private showAdGroupColOnly(): boolean {
    return !this.isTextAsset || this.uploadMode;
  }

  getUpdatedRows(): AdGroupRow[] {
    let updatedRows = this._adGroupRows.filter(
      (agRow) =>
        (this.showAdGroupColOnly() &&
          agRow.isEdited[AssetConn.ADGROUP] == true) ||
        (this.isTextAsset &&
          (agRow.isEdited[AssetConn.HEADLINE] == true ||
            agRow.isEdited[AssetConn.DESC] == true))
    );
    return updatedRows;
  }

  getSelectedAdGroupIDs(): number[] {
    let rows = this.getUpdatedRows();
    let agIds = [];
    rows.forEach((row) => agIds.push(row.id));

    return agIds;
  }
}
